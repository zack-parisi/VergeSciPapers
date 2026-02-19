import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import time

class ChanZuckerbergSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Chan Zuckerberg Initiative.
    Scrapes their science funding page for neuroscience-related funding opportunities.
    """
    name = "chan_zuckerberg"
    start_urls = ["https://chanzuckerberg.com/science/science-funding/"]
    
    def __init__(self, *args, **kwargs):
        super(ChanZuckerbergSpider, self).__init__(*args, **kwargs)
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
            self.logger.info("Using Selenium to fetch page...")
            self.driver.get(self.start_urls[0])
            
            # Wait for page to load with explicit wait
            wait = WebDriverWait(self.driver, 10)
            try:
                # Wait for the search input to be present
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#grants-search")))
            except TimeoutException:
                # If search not found, wait for body content
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # Additional wait for dynamic content
            time.sleep(2)
            
            # Count initial results before search
            initial_cards = self.driver.find_elements(By.CSS_SELECTOR, ".rfa-card")
            self.logger.info(f"Initial cards found: {len(initial_cards)}")
            
            # Note: Search functionality is not working reliably with automation
            # Using in-spider filtering instead for more reliable results
            self.logger.info("Using in-spider filtering for neuroscience-related grants")
            
            # Count total results
            total_cards = self.driver.find_elements(By.CSS_SELECTOR, ".rfa-card")
            self.logger.info(f"Total cards found: {len(total_cards)}")
            
            # Get the page source after search
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
            except Exception as e:
                self.logger.error(f"Error cleaning up driver: {e}")
    
    def parse(self, response):
        """Parse the main science funding page and filter for neuroscience opportunities."""
        try:
            # Look for RFA cards in the page
            rfa_cards = response.css('.rfa-card')
            
            for card in rfa_cards:
                # Extract title from the card
                title = card.css('.card__title::text').get()
                if not title:
                    title = card.css('.card__title h4::text').get()
                
                # Extract description - handle complex structure with multiple spans
                description = card.css('.card__text').get()
                if description:
                    # Get all text content from the card__text element, including nested spans
                    description = ' '.join(card.css('.card__text *::text').getall()).strip()
                else:
                    description = card.css('.card__text::text').get()
                
                # Extract amount from the card info
                amount = card.css('.card__info__desc::text').get()
                
                # Extract URL from the card link
                url = card.css('.card__link::attr(href)').get()
                if not url:
                    url = card.css('a[href*="/rfa/"]::attr(href)').get()
                
                # Check if the grant is closed
                status = card.css('.card__alert::text').get()
                is_closed = status and "closed" in status.lower()
                
                # Only process if we have a title, it contains neuroscience-related keywords, and is not closed
                if title and self._is_neuroscience_related(title, description) and not is_closed:
                    grant_item = GrantscraperItem()
                    grant_item["title"] = title.strip()
                    grant_item["description"] = description.strip() if description else ""
                    grant_item["amount"] = amount.strip() if amount else ""
                    grant_item["type"] = "Private"
                    grant_item["agency"] = "Chan Zuckerberg Initiative"
                    grant_item["url"] = response.urljoin(url) if url else response.url
                    
                    # Extract opportunity number from URL if present
                    if url:
                        opp_number = re.search(r'/rfa/([^/]+)/?$', url)
                        if opp_number:
                            grant_item["opportunityNumber"] = opp_number.group(1)
                    
                    yield grant_item
            
            # If no cards found, try alternative selectors
            if not rfa_cards:
                self._parse_alternative_structure(response)
                
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")
    
    def _is_neuroscience_related(self, title, description):
        """Check if the grant opportunity is neuroscience-related."""
        # Check if "neuro" is found in the description
        if description and "neuro" in description.lower():
            return True
        
        # Check if "neuro" is found in the title
        if title and "neuro" in title.lower():
            return True
            
        return False
    
    def _parse_alternative_structure(self, response):
        """Parse alternative HTML structure if the main card structure is not found."""
        try:
            # Look for any divs that might contain grant information
            grant_sections = response.css('[class*="card"], [class*="grant"], [class*="rfa"]')
            
            for section in grant_sections:
                title = section.css('h1::text, h2::text, h3::text, h4::text, h5::text').get()
                if not title:
                    title = section.css('a::text').get()
                
                description = section.css('p::text').get()
                
                # Look for amount information
                amount = section.css('[class*="amount"]::text, [class*="funding"]::text').get()
                
                # Look for URL
                url = section.css('a::attr(href)').get()
                
                # Check if the grant is closed (for alternative structure)
                status = section.css('[class*="alert"]::text, [class*="status"]::text').get()
                is_closed = status and "closed" in status.lower()
                
                if title and self._is_neuroscience_related(title, description) and not is_closed:
                    grant_item = GrantscraperItem()
                    grant_item["title"] = title.strip()
                    grant_item["description"] = description.strip() if description else ""
                    grant_item["amount"] = amount.strip() if amount else ""
                    grant_item["type"] = "Private"
                    grant_item["agency"] = "Chan Zuckerberg Initiative"
                    grant_item["url"] = response.urljoin(url) if url else response.url
                    
                    yield grant_item
                    
        except Exception as e:
            self.logger.error(f"Error parsing alternative structure: {e}")
    
    def parse_funding_page(self, response):
        """Parse individual funding pages for detailed information."""
        try:
            # Extract detailed funding information
            title = response.css('h1::text, h2::text').get()
            if not title:
                title = response.css('title::text').get()
            
            description = response.css('p::text, .description::text').get()
            
            # Look for amount information
            amount = response.css('[class*="amount"]::text, [class*="funding"]::text').get()
            
            if title and self._is_neuroscience_related(title, description):
                grant_item = GrantscraperItem()
                grant_item["title"] = title.strip()
                grant_item["description"] = description.strip() if description else ""
                grant_item["amount"] = amount.strip() if amount else ""
                grant_item["type"] = "Private"
                grant_item["agency"] = "Chan Zuckerberg Initiative"
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
