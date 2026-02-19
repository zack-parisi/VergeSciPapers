import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import time

class ALSAssociationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from ALS Association.
    Scrapes their grants page for neuroscience-related funding opportunities.
    """
    name = "als_association"
    start_urls = ["https://www.als.org/research/researchers/research-funding-opportunities"]
    
    def __init__(self, *args, **kwargs):
        super(ALSAssociationSpider, self).__init__(*args, **kwargs)
        self.driver = None
        # Setup headless Chrome
        self.setup_driver()
    
    def setup_driver(self):
        """Setup headless Chrome driver with enhanced options to bypass Cloudflare."""
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        # Additional options to appear more like a real browser
        chrome_options.add_argument("--disable-web-security")
        chrome_options.add_argument("--allow-running-insecure-content")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-plugins")
        chrome_options.add_argument("--disable-images")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            # Execute script to remove webdriver property and other automation indicators
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
            self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']})")
            self.logger.info("Chrome driver setup successful")
        except Exception as e:
            self.logger.error(f"Failed to setup Chrome driver: {e}")
            self.driver = None
    
    def start_requests(self):
        """Override start_requests to use Selenium instead of Scrapy's downloader."""
        if not self.driver:
            self.logger.error("Chrome driver not available")
            return
        
        # Use Selenium to get the page directly
        try:
            self.logger.info("Using Selenium to fetch page...")
            self.driver.get(self.start_urls[0])
            
            # Wait for page to load and check for Cloudflare
            wait = WebDriverWait(self.driver, 30)
            
            # Check if we're on a Cloudflare page
            cloudflare_check_count = 0
            max_cloudflare_checks = 5
            
            while cloudflare_check_count < max_cloudflare_checks:
                # Wait for basic page load
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                
                # Check page title and content for Cloudflare indicators
                page_title = self.driver.title.lower()
                page_source = self.driver.page_source.lower()
                
                if ("just a moment" in page_title or 
                    "cloudflare" in page_source or 
                    "verify you are human" in page_source or
                    "ray id:" in page_source):
                    
                    self.logger.info(f"Cloudflare protection detected (attempt {cloudflare_check_count + 1}), waiting...")
                    time.sleep(10)  # Wait longer for Cloudflare to process
                    cloudflare_check_count += 1
                else:
                    self.logger.info("Page loaded successfully, proceeding with parsing")
                    break
            
            if cloudflare_check_count >= max_cloudflare_checks:
                self.logger.warning("Could not bypass Cloudflare protection after multiple attempts")
            
            # Additional wait for dynamic content after Cloudflare
            time.sleep(5)
            
            # Log final page info for debugging
            self.logger.info(f"Final page title: {self.driver.title}")
            self.logger.info(f"Page source length: {len(self.driver.page_source)}")
            
            # Check if we have the expected content
            h2_elements = self.driver.find_elements(By.TAG_NAME, "h2")
            self.logger.info(f"Found {len(h2_elements)} h2 elements on page")
            
            # Get the page source after JavaScript execution
            page_source = self.driver.page_source
            
            # Create a dummy request for Scrapy
            from scrapy.http import Request
            request = Request(url=self.start_urls[0], dont_filter=True)
            
            # Create a response object with the rendered content
            from scrapy.http import HtmlResponse
            response = HtmlResponse(
                url=self.start_urls[0],
                body=page_source.encode('utf-8'),
                encoding='utf-8',
                request=request
            )
            
            # Call parse with the rendered response
            yield from self.parse(response)
            
        except Exception as e:
            self.logger.error(f"Error fetching page with Selenium: {e}")
        finally:
            self.cleanup_driver()

    def cleanup_driver(self):
        """Clean up the Chrome driver."""
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("Chrome driver cleaned up successfully")
            except Exception as e:
                self.logger.error(f"Error cleaning up driver: {e}")
            finally:
                self.driver = None

    def parse(self, response):
        """Parse the main grants page for funding opportunities."""
        try:
            # Process both sections: "Our Current Requests for Applications" and "Additional Grants and Awards"
            section_headers = [
                "Our Current Requests for Applications",
                "Additional Grants and Awards"
            ]
            
            for header_text in section_headers:
                yield from self._extract_grants_from_section(response, header_text)
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def _extract_grants_from_section(self, response, header_text):
        """Extract grants from a specific section header."""
        try:
            # Find the h2 heading with the specified text
            heading = response.xpath(f'//h2[contains(text(), "{header_text}")]')
            
            if not heading:
                self.logger.info(f"Section '{header_text}' not found")
                return
            
            # Get all following siblings until we hit another h2 or end
            siblings = heading.xpath('./following-sibling::*')
            
            for sibling in siblings:
                # Stop if we hit another h2 (next section)
                if sibling.xpath('self::h2').get():
                    break
                
                # Look for h4 elements that contain grant links
                if sibling.xpath('self::h4').get():
                    # Extract title and URL from the <a> tag
                    link_element = sibling.xpath('.//a')
                    title = link_element.xpath('string()').get()
                    url = link_element.xpath('./@href').get()
                    
                    if title and url:
                        # Clean the title by removing "(link is external)" suffix
                        title = title.strip()
                        if title.endswith("(link is external)"):
                            title = title[:-len("(link is external)")].strip()
                        
                        # Get the next sibling which should be the <p> with details
                        details_p = sibling.xpath('./following-sibling::*[1][self::p]')
                        if details_p:
                            # Parse the details using the improved method
                            parsed_details = self._parse_grant_details_from_response(details_p, response)
                        else:
                            parsed_details = {}
                        
                        grant_item = GrantscraperItem()
                        grant_item["title"] = title
                        grant_item["type"] = "Private"
                        grant_item["url"] = response.urljoin(url)
                        grant_item["agency"] = parsed_details.get("agency", "ALS Association")
                        grant_item["description"] = parsed_details.get("description", "")
                        grant_item["amount"] = parsed_details.get("amount", "")
                        grant_item["dates"] = parsed_details.get("dates", "")
                        
                        self.logger.info(f"Found grant: {title}")
                        yield grant_item
                        
        except Exception as e:
            self.logger.error(f"Error extracting grants from section '{header_text}': {e}")



    def _parse_grant_details_from_response(self, details_p, response):
        """Parse grant details from the response using XPath."""
        details = {}
        
        try:
            # Get the text content with proper handling of <br> tags
            # First get all text nodes and <br> elements
            text_parts = details_p.xpath('.//text() | .//br').getall()
            
            # Process the text parts
            content_parts = []
            for part in text_parts:
                if part == '<br>':
                    content_parts.append('\n')
                else:
                    content_parts.append(part)
            
            # Join and split by newlines
            full_text = ''.join(content_parts)
            lines = full_text.split('\n')
            
            current_field = None
            current_value = ""
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check for field headers
                if re.match(r'^(?:Organizations?|Organization):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "agency"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^Description:', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "description"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^(?:Funding Available|Available Funding|Award):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "amount"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^(?:Application Deadline|Deadline|LOI Deadline|Open Date):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "dates"
                    current_value = line.split(':', 1)[1].strip()
                    
                else:
                    # Continue the current field
                    if current_field:
                        current_value += " " + line
                        
            # Don't forget the last field
            if current_field and current_value:
                details[current_field] = current_value.strip()
                
        except Exception as e:
            self.logger.error(f"Error parsing grant details: {e}")
        
        return details

    def _parse_grant_details(self, details_text):
        """Parse grant details from the <p> text content."""
        details = {}
        
        try:
            # The text contains <br> tags, so we need to split properly
            # Replace <br> with newlines and split
            text_with_newlines = details_text.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
            lines = text_with_newlines.split('\n')
            
            current_field = None
            current_value = ""
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # Check for field headers
                if re.match(r'^(?:Organizations?|Organization):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "agency"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^Description:', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "description"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^(?:Funding Available|Available Funding|Award):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "amount"
                    current_value = line.split(':', 1)[1].strip()
                    
                elif re.match(r'^(?:Application Deadline|Deadline|LOI Deadline|Open Date):', line, re.IGNORECASE):
                    if current_field and current_value:
                        details[current_field] = current_value.strip()
                    current_field = "dates"
                    current_value = line.split(':', 1)[1].strip()
                    
                else:
                    # Continue the current field
                    if current_field:
                        current_value += " " + line
                        
            # Don't forget the last field
            if current_field and current_value:
                details[current_field] = current_value.strip()
                
        except Exception as e:
            self.logger.error(f"Error parsing grant details: {e}")
        
        return details

    def parse_funding_page(self, response):
        """Parse individual funding pages for detailed information."""
        try:
            # Extract detailed funding information
            title = response.css('h1::text, h2::text').get()
            if not title:
                title = response.css('title::text').get()
            
            if title and any(keyword in title.lower() for keyword in ['neuroscience', 'brain', 'research', 'grant', 'funding', 'award']):
                grant_item = GrantscraperItem()
                grant_item["title"] = title.strip()
                grant_item["type"] = "Private"
                grant_item["agency"] = "ALS Association"
                grant_item["url"] = response.url
                
                # Extract dates from the page content
                content = response.get()
                self._extract_dates(grant_item, content)
                
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error parsing funding page {response.url}: {e}")
    
    def _extract_dates(self, grant_item, content):
        """Extract dates from content using regex patterns."""
        try:
            date_patterns = [
                r'(\d{1,2}/\d{1,2}/\d{4})',
                r'(\d{4}-\d{2}-\d{2})',
                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}'
            ]
            for pattern in date_patterns:
                dates = re.findall(pattern, content)
                if dates:
                    if len(dates) > 1:
                        grant_item["dates"] = f"Open Date: {dates[0]}, Close Date: {dates[1]}"
                    else:
                        grant_item["dates"] = f"Open Date: {dates[0]}"
        except Exception as e:
            self.logger.error(f"Error extracting dates: {e}")
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
