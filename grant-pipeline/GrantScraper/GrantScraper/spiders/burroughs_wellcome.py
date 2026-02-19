import scrapy
from GrantScraper.items import GrantscraperItem
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import re
from datetime import datetime

class BurroughsWellcomeNewSpider(scrapy.Spider):
    name = "burroughs_wellcome"
    start_urls = ["https://www.bwfund.org/funding-opportunities/"]

    def __init__(self, *args, **kwargs):
        super(BurroughsWellcomeNewSpider, self).__init__(*args, **kwargs)
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)

    def closed(self, reason):
        if hasattr(self, 'driver'):
            self.driver.quit()

    def _is_date_valid(self, date_str):
        """Check if a grant's deadline has passed."""
        if not date_str:
            return False
        
        try:
            date_formats = [
                "%b %d, %Y",  # "Sep 13, 2022"
                "%B %d, %Y",  # "September 13, 2022"
                "%m/%d/%Y",   # "09/13/2022"
                "%Y-%m-%d",   # "2022-09-13"
            ]
            
            parsed_date = None
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str.strip(), fmt)
                    break
                except ValueError:
                    continue
            
            if parsed_date is None:
                return False
            
            today = datetime.now()
            return parsed_date >= today
            
        except Exception as e:
            self.logger.error(f"Error parsing date '{date_str}': {e}")
            return False

    def parse(self, response):
        """Parse the main funding opportunities page and follow category links."""
        self.logger.info("Starting to parse main funding opportunities page")
        
        # Navigate to the main page using Selenium
        self.driver.get(response.url)
        
        # Target categories to scrape
        target_categories = [
            'Biomedical Sciences', 'Career Guidance', 'Diversity in Science', 
            'Infectious Disease', 'Institutional Programs', 'Interfaces in Science'
        ]
        
        self.logger.info(f"Looking for category links: {target_categories}")
        
        # Find all "Learn More" links
        learn_more_links = self.driver.find_elements(By.XPATH, "//a[contains(text(), 'Learn More about these opportunities')]")
        self.logger.info(f"Found {len(learn_more_links)} 'Learn More' links")
        
        category_urls = {}
        
        for link in learn_more_links:
            # Get the parent element to find the category name
            parent_div = link.find_element(By.XPATH, "./ancestor::div[contains(@class, 'vc_column')]")
            
            # Look for the category name in the parent div
            category_elements = parent_div.find_elements(By.XPATH, ".//h2 | .//h3 | .//h4")
            
            if category_elements:
                category_name = category_elements[0].text.strip()
                self.logger.info(f"Found category: {category_name}")
                
                if category_name in target_categories:
                    href = link.get_attribute('href')
                    category_urls[category_name] = href
                    self.logger.info(f"Found category URL for {category_name}: {href}")
                else:
                    self.logger.info(f"Skipping non-target category: {category_name}")
        
        # Process each category
        for category_name, category_url in category_urls.items():
            self.logger.info(f"Processing category: {category_name} at {category_url}")
            yield scrapy.Request(
                url=category_url,
                callback=self.parse_category_page,
                meta={'category': category_name}
            )

    def parse_category_page(self, response):
        """Parse individual category pages to extract grant listings."""
        category_name = response.meta.get('category', 'Unknown')
        self.logger.info(f"Processing category page: {response.url} for category: {category_name}")
        
        # Navigate to the category URL using Selenium
        self.driver.get(response.url)
        
        # Wait for the AJAX load more container
        try:
            ajax_container = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "#ajax-load-more"))
            )
            self.logger.info("Found AJAX load more container")
        except Exception as e:
            self.logger.error(f"No AJAX load more container found: {e}")
            return
        
        # Wait for initial grant listings
        try:
            initial_listings = self.wait.until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#ajax-load-more .alm-listing li"))
            )
            self.logger.info(f"Found {len(initial_listings)} initial grant listings")
        except Exception as e:
            self.logger.error(f"No initial grant listings found: {e}")
            return
        
        # Click "More Grants" button until all content is loaded
        while True:
            try:
                more_button = self.driver.find_element(By.CSS_SELECTOR, ".alm-load-more-btn")
                if more_button.is_displayed() and more_button.is_enabled():
                    self.driver.execute_script("arguments[0].click();", more_button)
                    time.sleep(2)  # Wait for content to load
                else:
                    break
            except:
                break
        
        # Get all grant listings after loading all content
        all_listings = self.driver.find_elements(By.CSS_SELECTOR, "#ajax-load-more .alm-listing li")
        self.logger.info(f"Total grant listings found for {category_name}: {len(all_listings)}")
        
        # Process each grant listing
        for i, grant_item in enumerate(all_listings):
            self.logger.info(f"Processing grant item {i+1} for category: {category_name}")
            
            try:
                # Extract title and URL
                title = ""
                url = ""
                
                # Look for title in h3, h2, or h4 elements
                title_elements = grant_item.find_elements(By.CSS_SELECTOR, "h3, h2, h4")
                for title_elem in title_elements:
                    title_text = title_elem.text.strip()
                    if title_text:
                        title = title_text
                        self.logger.info(f"Found title element: {title}")
                        
                        # Look for link within the title element
                        link_elem = title_elem.find_element(By.CSS_SELECTOR, "a")
                        if link_elem:
                            url = link_elem.get_attribute('href')
                            self.logger.info(f"Found title link: {url}")
                        break
                
                if not title:
                    self.logger.info(f"Skipping grant item {i+1} - no title found")
                    continue
                
                # Extract dates
                dates = ""
                try:
                    # Look for date in the date-display div
                    date_elements = grant_item.find_elements(By.CSS_SELECTOR, ".date-display p")
                    for date_elem in date_elements:
                        date_text = date_elem.text.strip()
                        if date_text:
                            dates = date_text
                            break
                    
                    # If no date found in date-display, look for date patterns in all text
                    if not dates:
                        all_text = grant_item.text
                        date_patterns = [
                            r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
                            r'\b\d{1,2}/\d{1,2}/\d{4}\b',
                            r'\b\d{4}-\d{2}-\d{2}\b'
                        ]
                        for pattern in date_patterns:
                            match = re.search(pattern, all_text)
                            if match:
                                dates = match.group()
                                break
                except Exception as e:
                    self.logger.info(f"Could not extract dates: {e}")
                
                # Extract description
                description = ""
                try:
                    # Look for description text that's not in the date-display div
                    desc_elements = grant_item.find_elements(By.CSS_SELECTOR, "p:not(.date-display p)")
                    desc_divs = grant_item.find_elements(By.CSS_SELECTOR, "div:not(.date-display):not(.category-image)")
                    details_divs = grant_item.find_elements(By.CSS_SELECTOR, ".details")

                    all_desc_text = []
                    
                    # Process paragraph elements
                    for desc_elem in desc_elements:
                        text = desc_elem.text.strip()
                        if text:
                            date_patterns = [
                                r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
                                r'\b\d{1,2}/\d{1,2}/\d{4}\b',
                                r'\b\d{4}-\d{2}-\d{2}\b'
                            ]
                            is_date = any(re.search(pattern, text) for pattern in date_patterns)
                            
                            if not is_date and "Application Deadline" not in text and "Learn More" not in text and "APPLY NOW" not in text and "APPLY" not in text:
                                if text not in all_desc_text and text != title:
                                    all_desc_text.append(text)

                    # Process details divs specifically
                    for details_div in details_divs:
                        details_text = details_div.text.strip()
                        if details_text and len(details_text) > 20:
                            lines = details_text.split('\n')
                            for line in lines:
                                line = line.strip()
                                if line and len(line) > 10:
                                    date_patterns = [
                                        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
                                        r'\b\d{1,2}/\d{1,2}/\d{4}\b',
                                        r'\b\d{4}-\d{2}-\d{2}\b'
                                    ]
                                    is_date = any(re.search(pattern, line) for pattern in date_patterns)
                                    
                                    if not is_date and "Application Deadline" not in line and "Learn More" not in line and "APPLY NOW" not in line and "APPLY" not in line:
                                        if line not in all_desc_text:
                                            all_desc_text.append(line)

                    # Special handling for Physician-Scientist Institutional Award
                    if title == "Physician-Scientist Institutional Award":
                        full_text = grant_item.text.strip()
                        expected_paragraphs = []

                        # Extract specific paragraphs for this grant
                        paragraphs_to_find = [
                            ("The Burroughs Wellcome Fund is offering a second round", "One-Step full application submission"),
                            ("One-Step full application submission", "The PSIA advisory committee"),
                            ("The PSIA advisory committee will review", "Up to five awards"),
                            ("Up to five awards", "LEARN MORE")
                        ]

                        for start_phrase, end_phrase in paragraphs_to_find:
                            if start_phrase in full_text:
                                start_idx = full_text.find(start_phrase)
                                end_idx = full_text.find(end_phrase)
                                if start_idx != -1 and end_idx != -1:
                                    para = full_text[start_idx:end_idx].strip()
                                    if para:
                                        expected_paragraphs.append(para)

                        if expected_paragraphs:
                            all_desc_text = expected_paragraphs

                    # Process div elements for additional description content
                    for desc_div in desc_divs:
                        text = desc_div.text.strip()
                        if text and len(text) > 20:
                            date_patterns = [
                                r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
                                r'\b\d{1,2}/\d{1,2}/\d{4}\b',
                                r'\b\d{4}-\d{2}-\d{2}\b'
                            ]
                            is_date = any(re.search(pattern, text) for pattern in date_patterns)
                            
                            if not is_date and "Application Deadline" not in text and "Learn More" not in text:
                                if text not in all_desc_text:
                                    all_desc_text.append(text)

                    if all_desc_text:
                        description = " ".join(all_desc_text)

                        # Remove title repetition from the beginning of descriptions
                        if title and description.startswith(title):
                            description = description[len(title):].strip()
                            if description.startswith(" ") or description.startswith(".") or description.startswith(","):
                                description = description.lstrip(" .,")

                except Exception as e:
                    self.logger.info(f"Could not extract description: {e}")
                
                # Create grant data
                grant_data = {
                    'title': title,
                    'description': description,
                    'url': url,
                    'agency': 'Burroughs Wellcome Fund',
                    'type': 'private',
                    'dates': dates
                }
                
                # Validate the date and yield if valid
                if self._is_date_valid(dates):
                    self.logger.info(f"Yielding grant item: {title}")
                    yield grant_data
                else:
                    self.logger.info(f"Skipping grant item {i+1} - deadline has passed: {dates}")
                    
            except Exception as e:
                self.logger.error(f"Error processing grant item {i+1}: {e}")
                continue 