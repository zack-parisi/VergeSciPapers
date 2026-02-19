import scrapy
import json
import re
import html
import time
from urllib.parse import urljoin
from GrantScraper.items import GrantscraperItem
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from scrapy.http import HtmlResponse
import logging


class WellcomeTrustSpider(scrapy.Spider):
    """
    Spider for scraping grant information from Wellcome Trust website.
    
    This spider uses Selenium to bypass anti-bot protection and extracts
    grant data from the __NEXT_DATA__ JSON script embedded in the page.
    """
    
    name = 'wellcome_trust'
    allowed_domains = ['wellcome.org']
    start_urls = [
        'https://wellcome.org/research-funding/schemes?f%5B0%5D=strategic_programme%3A10327&f%5B1%5D=strategic_programme%3A10622&f%5B2%5D=strategic_programme%3A10623&f%5B3%5D=strategic_programme%3A10328&f%5B4%5D=currently_accepting_applications%3AYes&f%5B5%5D=currently_accepting_applications%3AUpcoming'
    ]
    
    def __init__(self, *args, **kwargs):
        super(WellcomeTrustSpider, self).__init__(*args, **kwargs)
        self.driver = None
        self.setup_driver()
    
    def setup_driver(self):
        """Setup Chrome driver with anti-detection measures."""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')
        chrome_options.add_argument('--disable-images')
        chrome_options.add_argument('--disable-javascript')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        
        # Execute script to mask automation
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
        self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']})")
    
    def cleanup_driver(self):
        """Clean up the driver."""
        if self.driver:
            self.driver.quit()
    
    def closed(self, reason):
        """Clean up when spider is closed."""
        self.cleanup_driver()

    def start_requests(self):
        """Override to use Selenium for page fetching."""
        for url in self.start_urls:
            try:
                # First try to access robots.txt to respect it
                robots_url = 'https://wellcome.org/robots.txt'
                self.driver.get(robots_url)
                self.logger.info("Successfully accessed robots.txt")
                
                # Now fetch the main page
                self.driver.get(url)
                self.logger.info(f"Successfully fetched page: {url}")
                
                # Log the current URL to see if it matches what we expect
                current_url = self.driver.current_url
                self.logger.info(f"Current page URL: {current_url}")
                
                # Check if the URL contains the expected filters
                self._check_url_filters(current_url)
                
                # Wait for page to load and JavaScript to apply filters
                self._wait_for_page_load()
                
                # Get the page source and create response
                page_source = self.driver.page_source
                response = HtmlResponse(
                    url=url,
                    body=page_source.encode('utf-8'),
                    encoding='utf-8'
                )
                
                # Yield from parse method directly
                yield from self.parse(response)
                
            except Exception as e:
                self.logger.error(f"Error fetching {url}: {str(e)}")
                # Fallback to regular Scrapy request
                yield scrapy.Request(url, callback=self.parse, dont_filter=True)
    
    def _check_url_filters(self, current_url):
        """Check if the URL contains the expected filter parameters."""
        expected_filters = [
            'strategic_programme:10327', 
            'strategic_programme:10622', 
            'strategic_programme:10623', 
            'strategic_programme:10328', 
            'currently_accepting_applications:Yes', 
            'currently_accepting_applications:Upcoming'
        ]
        
        for filter_param in expected_filters:
            if filter_param in current_url:
                self.logger.info(f"Found filter parameter: {filter_param}")
            else:
                self.logger.warning(f"Missing filter parameter: {filter_param}")
    
    def _wait_for_page_load(self):
        """Wait for page to load and JavaScript to apply filters."""
        # Wait for page to load
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Wait a bit more for JavaScript to apply filters
        time.sleep(3)
    
    def parse(self, response):
        """Parse the page and extract grant information."""
        self.logger.info("Starting to parse page")
        
        # First try to extract data from __NEXT_DATA__ script tag
        next_data_script = response.css('script#__NEXT_DATA__::text').get()
        if next_data_script:
            self.logger.info("Found __NEXT_DATA__ script, extracting from JSON")
            try:
                next_data = json.loads(next_data_script)
                yield from self._extract_from_next_data(next_data, response)
                return
            except json.JSONDecodeError as e:
                self.logger.warning(f"Failed to parse __NEXT_DATA__ JSON: {e}")
        
        # Fallback to HTML parsing
        self.logger.info("Falling back to HTML parsing")
        yield from self._extract_from_html(response)
    
    def _extract_from_next_data(self, next_data, response):
        """Extract grant data from __NEXT_DATA__ JSON."""
        try:
            # Navigate through the JSON structure to find grant data
            props = next_data.get('props', {})
            page_props = props.get('pageProps', {})
            
            # Look for grant data in various possible locations
            grants_data = self._find_grants_data(page_props)
            
            if grants_data:
                self.logger.info(f"Found {len(grants_data)} grants in JSON data")
                
                # Check if we're using initialListings (all grants) and need to filter
                if 'initialListings' in page_props and len(grants_data) > 10:
                    self.logger.warning(f"Found {len(grants_data)} grants in initialListings, but URL has filters. Checking HTML for visible grants.")
                    
                    # Get the visible grants from HTML to cross-reference
                    visible_grant_urls = self._get_visible_grant_urls(response)
                    self.logger.info(f"Found {len(visible_grant_urls)} visible grants in HTML")
                    
                    # Only extract grants that are actually visible on the page
                    extracted_count = 0
                    for grant_data in grants_data:
                        grant_url = grant_data.get('url', '')
                        if grant_url and any(visible_url in grant_url for visible_url in visible_grant_urls):
                            item = self._create_item_from_json(grant_data, response)
                            if item:
                                yield item
                                extracted_count += 1
                    
                    self.logger.info(f"Extracted {extracted_count} grants that match visible grants on page")
                else:
                    # Use all grants if we have a reasonable number or if we're not using initialListings
                    for grant_data in grants_data:
                        item = self._create_item_from_json(grant_data, response)
                        if item:
                            yield item
            else:
                self.logger.warning("No grant data found in __NEXT_DATA__")
                
        except Exception as e:
            self.logger.error(f"Error extracting from __NEXT_DATA__: {e}")
    
    def _find_grants_data(self, page_props):
        """Find grants data in the page props."""
        # Try different possible paths in the JSON structure
        # Look for filtered results first, then fallback to all listings
        if 'filteredListings' in page_props:
            return page_props['filteredListings']
        elif 'results' in page_props:
            return page_props['results']
        elif 'filtered' in page_props:
            return page_props['filtered']
        elif 'initialListings' in page_props:
            # Only use initialListings if we can't find filtered results
            # This contains all grants, not just the filtered ones
            self.logger.warning("Using initialListings (all grants) instead of filtered results")
            return page_props['initialListings']
        elif 'grants' in page_props:
            return page_props['grants']
        elif 'schemes' in page_props:
            return page_props['schemes']
        elif 'data' in page_props:
            return page_props['data']
        elif 'items' in page_props:
            return page_props['items']
        
        return None
    
    def _find_grants_in_json(self, data, path=""):
        """Recursively search for grant data in JSON structure."""
        if isinstance(data, dict):
            for key, value in data.items():
                current_path = f"{path}.{key}" if path else key
                
                # Check if this looks like grant data
                if key.lower() in ['grants', 'schemes', 'items', 'data'] and isinstance(value, list):
                    if value and isinstance(value[0], dict):
                        # Check if first item has grant-like fields
                        first_item = value[0]
                        if any(field in first_item for field in ['title', 'name', 'url', 'href', 'description']):
                            self.logger.info(f"Found potential grant data at {current_path}")
                            return value
                
                # Recursively search
                result = self._find_grants_in_json(value, current_path)
                if result:
                    return result
                    
        elif isinstance(data, list) and data:
            # Check if this list contains grant-like objects
            if isinstance(data[0], dict):
                first_item = data[0]
                if any(field in first_item for field in ['title', 'name', 'url', 'href', 'description']):
                    self.logger.info(f"Found potential grant data at {path}")
                    return data
        
        return None
    
    def _get_visible_grant_urls(self, response):
        """Extract URLs of grants that are actually visible on the page."""
        visible_urls = []
        
        # Look for grant links that are visible (not hidden by CSS)
        grant_links = response.css('article.c-text-card--scheme:not(.tw-invisible) a[href*="/research-funding/schemes/"]')
        
        for link in grant_links:
            url = link.attrib.get('href', '')
            if url:
                visible_urls.append(url)
        
        # If no visible grants found, try a broader search
        if not visible_urls:
            grant_links = response.css('a[href*="/research-funding/schemes/"]')
            for link in grant_links:
                url = link.attrib.get('href', '')
                if url:
                    visible_urls.append(url)
        
        return visible_urls
    
    def _create_item_from_json(self, grant_data, response):
        """Create a GrantscraperItem from JSON grant data."""
        try:
            item = GrantscraperItem()
            
            # Extract title
            title = grant_data.get('title') or grant_data.get('name') or grant_data.get('heading')
            if not title:
                return None
            
            item['title'] = title
            
            # Extract URL
            url = grant_data.get('url') or grant_data.get('href') or grant_data.get('link')
            if url:
                if url.startswith('/'):
                    item['url'] = response.urljoin(url)
                else:
                    item['url'] = url
            else:
                item['url'] = ""
            
            # Extract description
            item['description'] = self._clean_html_text(
                grant_data.get('listing_summary') or 
                grant_data.get('description') or 
                grant_data.get('summary') or 
                grant_data.get('excerpt')
            )
            
            # Extract dates
            item['dates'] = self._extract_dates(grant_data)
            
            # Extract eligibility
            item['eligibility'] = self._extract_eligibility(grant_data)
            
            # Extract amount
            item['amount'] = self._clean_html_text(
                grant_data.get('level_of_funding') or 
                grant_data.get('amount') or 
                grant_data.get('funding_amount') or 
                grant_data.get('funding')
            )
            
            # Static fields
            item['agency'] = "Wellcome Trust"
            item['type'] = "private"
            
            # Extract opportunity number from URL
            item['opportunityNumber'] = self._extract_opportunity_number(item['url'])
            
            self.logger.info(f"Created item: {item['title']}")
            return item
            
        except Exception as e:
            self.logger.error(f"Error creating item from JSON: {e}")
            return None
    
    def _clean_html_text(self, text):
        """Clean HTML entities and tags from text."""
        if not text:
            return ""
        
        # Clean up HTML entities and tags
        text = html.unescape(text)
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        return text.strip()
    
    def _extract_dates(self, grant_data):
        """Extract dates from grant data."""
        dates_parts = []
        
        if grant_data.get('scheme_accepting_applications'):
            dates_parts.append(f"Status: {grant_data['scheme_accepting_applications']}")
        if grant_data.get('scheme_closes_for_applications'):
            dates_parts.append(f"Closes: {grant_data['scheme_closes_for_applications']}")
        if grant_data.get('scheme_opens_for_applications'):
            dates_parts.append(f"Opens: {grant_data['scheme_opens_for_applications']}")
        
        return "; ".join(dates_parts) if dates_parts else ""
    
    def _extract_eligibility(self, grant_data):
        """Extract eligibility information from grant data."""
        eligibility_parts = []
        
        # Extract career stage
        if grant_data.get('lead_applicant_career_stage'):
            career_stages = []
            for stage in grant_data['lead_applicant_career_stage']:
                if isinstance(stage, dict) and stage.get('name'):
                    career_stages.append(stage['name'])
            if career_stages:
                eligibility_parts.append(f"Lead applicant career stage: {', '.join(career_stages)}")
        
        # Extract location
        if grant_data.get('location_ref'):
            locations = []
            for location in grant_data['location_ref']:
                if isinstance(location, dict) and location.get('name'):
                    locations.append(location['name'])
            if locations:
                eligibility_parts.append(f"Administering organisation location: {', '.join(locations)}")
        
        return "; ".join(eligibility_parts) if eligibility_parts else ""
    
    def _extract_opportunity_number(self, url):
        """Extract opportunity number from URL."""
        if not url:
            return ""
        
        url_parts = url.split('/')
        if len(url_parts) > 1:
            return url_parts[-1]
        return ""
    
    def _extract_from_html(self, response):
        """Fallback method to extract grant data from HTML."""
        self.logger.info("Extracting from HTML structure")
        
        # Find grant listings
        grant_listings = response.css('article.c-text-card--scheme')
        self.logger.info(f"Found {len(grant_listings)} grant listings")
        
        for listing in grant_listings:
            item = self._extract_grant_info(listing, response)
            if item:
                yield item
    
    def _extract_grant_info(self, listing, response):
        """Extract grant information from a listing element."""
        grant_item = GrantscraperItem()
        
        # Debug: Print the listing HTML to see what we're working with
        listing_html = listing.get()
        self.logger.debug(f"Processing listing: {listing_html[:200]}...")
        
        # Extract title and URL
        title_element = listing.css('h3 a, .c-text-card__title a, a[href*="/research-funding/schemes/"]')
        if not title_element:
            # Try alternative selectors
            title_element = listing.css('a[href*="/schemes/"], .title a, .grant-title a')
        
        # Debug: Print what we found
        self.logger.debug(f"Title elements found: {len(title_element)}")
        for i, elem in enumerate(title_element):
            self.logger.debug(f"Title element {i}: {elem.get()}")
        
        if title_element:
            # Get the first title element (should be the main grant title)
            title_text = title_element.css('::text').get().strip()
            title_url = title_element.attrib.get('href', '')
            
            # Only use this if it looks like a real grant title (not navigation, etc.)
            if title_text and len(title_text) > 5 and "/research-funding/schemes/" in title_url:
                grant_item["title"] = title_text
                grant_item["url"] = response.urljoin(title_url)
                self.logger.info(f"Found linked title: {grant_item['title']}")
            else:
                # Fallback for title without link
                title_text = listing.css('h3[class*="c-text-card__title"], .c-text-card__title, .title, .grant-title, .scheme-title').css('::text').get()
                grant_item["title"] = title_text.strip() if title_text else ""
                grant_item["url"] = ""
                if title_text:
                    self.logger.info(f"Found unlinked title: {grant_item['title']}")
        else:
            # Fallback for title without link
            title_text = listing.css('h3[class*="c-text-card__title"], .c-text-card__title, .title, .grant-title, .scheme-title').css('::text').get()
            grant_item["title"] = title_text.strip() if title_text else ""
            grant_item["url"] = ""
            if title_text:
                self.logger.info(f"Found unlinked title: {grant_item['title']}")
        
        # Skip items without meaningful titles - be less restrictive
        if not grant_item["title"] or len(grant_item["title"]) < 3:
            self.logger.debug(f"Skipping item with title: '{grant_item['title']}'")
            return None
        
        # Extract dates
        dates_selectors = [
            '.c-pill, .c-text-card__status, .deadline, [class*="date"], [class*="deadline"], .highlight, .status, .deadline-date'
        ]
        dates_text = ""
        for selector in dates_selectors:
            dates_element = listing.css(selector)
            if dates_element:
                dates_text = dates_element.css('::text').get().strip()
                if dates_text:
                    break
        grant_item["dates"] = dates_text
        
        # Extract description
        description_selectors = [
            '.c-rich-text, .c-text-card__description, .description, .summary, p, [class*="description"], [class*="summary"], .grant-description, .scheme-description'
        ]
        description_text = ""
        for selector in description_selectors:
            desc_element = listing.css(selector)
            if desc_element:
                description_text = desc_element.css('::text').get().strip()
                if description_text:
                    break
        grant_item["description"] = description_text
        
        # Extract eligibility
        eligibility_text = ""
        career_stage_element = listing.css('.c-scheme-info:contains("Lead applicant career stage:") .c-scheme-info__item-list')
        if career_stage_element:
            career_stage_text = career_stage_element.css('::text').get().strip()
            eligibility_text += f"Lead applicant career stage: {career_stage_text}; "
        
        location_element = listing.css('.c-scheme-info:contains("Administering organisation location:") .c-scheme-info__item-list')
        if location_element:
            location_text = location_element.css('::text').get().strip()
            eligibility_text += f"Administering organisation location: {location_text}"
        
        grant_item["eligibility"] = eligibility_text.strip()
        
        # Extract amount
        amount_text = ""
        amount_element = listing.css('.c-scheme-info:contains("Funding amount:") .c-scheme-info__description')
        if amount_element:
            amount_text = amount_element.css('::text').get().strip()
        grant_item["amount"] = amount_text
        
        # Static fields
        grant_item["agency"] = "Wellcome Trust"
        grant_item["type"] = "private"
        
        # Extract opportunity number from URL
        grant_item["opportunityNumber"] = self._extract_opportunity_number(grant_item["url"])
        
        self.logger.info(f"Successfully extracted grant: {grant_item['title']}")
        return grant_item 
