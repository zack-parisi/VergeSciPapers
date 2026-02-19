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

class EpilepsyFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Epilepsy Foundation.
    Scrapes their grants page for neuroscience-related funding opportunities.
    """
    name = "epilepsy_foundation"
    start_urls = ["https://www.epilepsy.com/research-funding/about/grants"]
    
    def __init__(self, *args, **kwargs):
        super(EpilepsyFoundationSpider, self).__init__(*args, **kwargs)
        self.driver = None
        # Setup headless Chrome
        self.setup_driver()
    
    def setup_driver(self):
        """Setup headless Chrome driver with enhanced options."""
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            # Execute script to remove webdriver property
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
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
            
            # Wait for page to load with explicit wait
            wait = WebDriverWait(self.driver, 15)  # Increased timeout for Cloudflare
            try:
                # Wait for either h2 elements or body to be present
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "h2")))
            except TimeoutException:
                # If h2 not found, wait for body content
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # Additional wait for dynamic content and Cloudflare to clear
            time.sleep(5)
            
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
            # Find all h3 elements that contain grant information (title - date format)
            # Handle both hyphen (-) and em dash (–) formats
            grant_h3s = response.xpath('//h3[contains(text(), " - ") or contains(text(), " – ")]')
            
            for grant_h3 in grant_h3s:
                grant_item = self._extract_grant_from_h3(grant_h3, response)
                if grant_item:
                    yield grant_item
                        
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")
    
    def _extract_grant_from_h3(self, grant_h3, response):
        """Extract grant information from an h3 element containing title - date format."""
        try:
            # Get the h3 text which contains "title - date" or "title – date"
            h3_text = grant_h3.xpath('.//text()').get()
            if not h3_text:
                return None
            
            # Split by " - " or " – " to separate title and date
            # Try em dash first, then hyphen
            if " – " in h3_text:
                parts = h3_text.strip().split(" – ")
            elif " - " in h3_text:
                parts = h3_text.strip().split(" - ")
            else:
                return None
                
            if len(parts) != 2:
                return None
            
            title = parts[0].strip()
            dates = parts[1].strip()
            
            # Find the parent p element that contains this h3
            # Navigate up until we find a p element
            parent_p = grant_h3
            while parent_p and parent_p.xpath('name()').get() != 'p':
                parent_p = parent_p.xpath('..')
                if not parent_p:
                    break
            
            agency = "Epilepsy Foundation"  # Default
            description = ""
            
            if parent_p:
                # Find all p elements within the parent p
                p_elements = parent_p.xpath('.//p')
                
                # Find the agency (first p element that's not empty)
                for p in p_elements:
                    p_text = p.xpath('.//text()').get()
                    if p_text and p_text.strip():
                        agency = p_text.strip()
                        break
                
                # Find the description (next p element after agency)
                for i, p in enumerate(p_elements):
                    p_text = p.xpath('.//text()').get()
                    if p_text and p_text.strip() and p_text.strip() != agency:
                        description = p_text.strip()
                        break
                
                # Find the URL (link or button within the same parent p)
                url_element = parent_p.xpath('.//a | .//button')
                url = url_element.xpath('.//@href').get()
                if url:
                    url = response.urljoin(url)
                else:
                    url = response.url
            else:
                # If no parent p, look for agency and description in following siblings
                agency_p = grant_h3.xpath('following-sibling::p[1]')
                if agency_p:
                    agency_text = agency_p.xpath('.//text()').get()
                    if agency_text:
                        agency = agency_text.strip()
                
                description_p = grant_h3.xpath('following-sibling::p[2]')
                if description_p:
                    description_text = description_p.xpath('.//text()').get()
                    if description_text:
                        description = description_text.strip()
                
                # Find URL in following siblings
                url_element = grant_h3.xpath('following-sibling::a[1] | following-sibling::button[1]')
                url = url_element.xpath('.//@href').get()
                if url:
                    url = response.urljoin(url)
                else:
                    url = response.url
            
            # Create grant item
            grant_item = GrantscraperItem()
            grant_item["title"] = title
            grant_item["dates"] = dates
            grant_item["agency"] = agency
            grant_item["description"] = description
            grant_item["url"] = url
            grant_item["type"] = "Private"
            
            return grant_item
            
        except Exception as e:
            self.logger.error(f"Error extracting grant from h3: {e}")
            return None
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}") 