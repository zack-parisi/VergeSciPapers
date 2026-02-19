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

class SloanFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Alfred P. Sloan Foundation.
    Scrapes their grants page for neuroscience-related funding opportunities.
    Uses Selenium to handle Cloudflare protection.
    
    Key features:
    - Uses Selenium WebDriver to bypass Cloudflare protection
    - Targets https://sloan.org/grants/open-calls for current opportunities
    - Extracts grant titles, descriptions, URLs, and dates
    - Filters for neuroscience-related keywords
    - Handles various HTML structures and selectors
    """
    name = "sloan_foundation"
    start_urls = ["https://sloan.org/grants/open-calls"]
    
    def __init__(self, *args, **kwargs):
        super(SloanFoundationSpider, self).__init__(*args, **kwargs)
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
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
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
            self.logger.info("Using Selenium to fetch Sloan Foundation grants page...")
            self.driver.get(self.start_urls[0])
            
            # Wait for page to load with explicit wait
            wait = WebDriverWait(self.driver, 15)
            try:
                # Wait for content to be present
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                # Additional wait for dynamic content
                time.sleep(3)
            except TimeoutException:
                self.logger.warning("Timeout waiting for page content")
            
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
            
            yield request
            
        except Exception as e:
            self.logger.error(f"Error fetching page with Selenium: {e}")
    
    def cleanup_driver(self):
        """Clean up the Chrome driver."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                self.logger.error(f"Error closing driver: {e}")
    
    def closed(self, reason):
        """Called when spider is closed."""
        self.cleanup_driver()
    
    def parse(self, response):
        """Parse the Sloan Foundation grants page for funding opportunities."""
        try:
            self.logger.info(f"Parsing Sloan Foundation grants page: {response.url}")
            
            # Look for grant opportunities using various selectors
            grant_selectors = [
                'article', 'div[class*="grant"]', 'div[class*="opportunity"]', 
                'div[class*="funding"]', '.grant-item', '.opportunity-item',
                'section[class*="grant"]', 'section[class*="opportunity"]',
                '.program-item', '.fellowship-item', '.research-item',
                'div[class*="program"]', 'div[class*="fellowship"]',
                '.sloan-program', '.sloan-fellowship', '.sloan-grant'
            ]
            
            grant_entries = []
            for selector in grant_selectors:
                entries = response.css(selector)
                if entries:
                    grant_entries.extend(entries)
                    self.logger.info(f"Found {len(entries)} entries with selector: {selector}")
            
            # If no specific grant containers found, try a more general approach
            if not grant_entries:
                grant_entries = response.css('div, article, section')
                self.logger.info(f"Using fallback selector - found {len(grant_entries)} potential containers")
            
            # Track processed titles to avoid duplicates
            processed_titles = set()
            
            for entry in grant_entries:
                # Skip entries that are too small
                entry_text = entry.get()
                if len(entry_text) < 50:
                    continue
                
                # Check if entry contains grant-related keywords
                grant_keywords = ['grant', 'funding', 'opportunity', 'award', 'fellowship', 'research', 'neuroscience', 'brain', 'cognitive', 'neural', 'sloan', 'fellowship', 'research program']
                if not any(keyword in entry_text.lower() for keyword in grant_keywords):
                    continue
                
                grant_item = self._extract_grant_data(entry, response)
                if grant_item and grant_item.get('title'):
                    # Check for duplicates
                    title = grant_item.get('title', '').strip()
                    if title and title not in processed_titles:
                        processed_titles.add(title)
                        yield grant_item
            
            # Look for funding opportunity links
            funding_links = response.css('a[href*="grant"], a[href*="funding"], a[href*="award"], a[href*="research"]::attr(href)').getall()
            
            for link in funding_links:
                if link and not link.startswith('#'):
                    yield response.follow(link, self.parse_funding_page, errback=self.handle_error)
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def _extract_grant_data(self, entry, response):
        """Extract grant data from a single entry element."""
        try:
            # Extract title from various possible elements
            title_elements = entry.css('h1 a, h2 a, h3 a, h4 a, .title a, a[href*="/grants/"], a[href*="/funding/"], a[href*="/programs/"], a[href*="/fellowships/"]')
            title_element = title_elements[0] if title_elements else None
            if not title_element:
                title_elements = entry.css('h1, h2, h3, h4, .title, strong a, b a, .program-title, .fellowship-title')
                title_element = title_elements[0] if title_elements else None
            
            title = ""
            if title_element:
                title = title_element.get().strip()
                # Clean up HTML tags if present
                title = re.sub(r'<[^>]+>', '', title)
                
                # If title is still empty, try to get text content
                if not title:
                    title = title_element.css('::text').get().strip()
                
                # Clean up HTML entities and extra whitespace
                import html
                title = html.unescape(title)
                title = re.sub(r'\s+', ' ', title).strip()
            
            # Extract URL from title link
            url = ""
            if title_element and title_element.attrib.get('href'):
                url = response.urljoin(title_element.attrib['href'])
            
            # Extract description
            description = ""
            desc_elements = entry.css('p, .description, .content, .summary')
            if desc_elements:
                desc_text = desc_elements[0].get().strip()
                desc_text = re.sub(r'<[^>]+>', '', desc_text)
                import html
                description = html.unescape(desc_text)
                description = re.sub(r'\s+', ' ', description).strip()
            
            if title:
                grant_item = GrantscraperItem()
                grant_item["title"] = title
                grant_item["type"] = "Private"
                grant_item["agency"] = "Alfred P. Sloan Foundation"
                grant_item["url"] = url if url else response.url
                grant_item["description"] = description
                
                # Try to extract opportunity number from URL or text
                if url:
                    opp_number = re.search(r'/([A-Z0-9-]+)$', url)
                    if opp_number:
                        grant_item["opportunityNumber"] = opp_number.group(1)
                
                # Extract dates from the content
                content = entry.get()
                self._extract_dates(grant_item, content)
                
                return grant_item
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting grant data: {e}")
            return None

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
                grant_item["agency"] = "Alfred P. Sloan Foundation"
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
                    break
        except Exception as e:
            self.logger.error(f"Error extracting dates: {e}")
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
