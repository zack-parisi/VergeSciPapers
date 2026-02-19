import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class HHMISpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Howard Hughes Medical Institute.
    Scrapes their grants page for neuroscience-related funding opportunities.
    """
    name = "hhmi"
    start_urls = ["https://www.hhmi.org/programs"]
    
    def parse(self, response):
        """Parse the main grants page for funding opportunities."""
        try:
            # Find the "Open" section by looking for hhmi-program-card-list with heading="Open"
            open_section = response.xpath('//hhmi-program-card-list[@heading="Open"]')
            
            if open_section:
                # Extract all hhmi-program-card elements within the Open section
                program_cards = open_section.xpath('.//hhmi-program-card')
                
                for card in program_cards:
                    # Extract title from the heading attribute
                    title = card.xpath('./@heading').get()
                    
                    if title:
                        grant_item = GrantscraperItem()
                        grant_item["title"] = title.strip()
                        grant_item["type"] = "private"
                        grant_item["agency"] = "hhmi"
                        
                        # Extract description from the description attribute
                        description = card.xpath('./@description').get()
                        if description:
                            # Clean up HTML tags from description
                            description = re.sub(r'<[^>]+>', '', description)
                            description = description.replace('&nbsp;', ' ')
                            grant_item["description"] = description.strip()
                        
                        # Extract URL from linkurl attribute
                        link_url = card.xpath('./@linkurl').get()
                        if link_url:
                            grant_item["url"] = response.urljoin(link_url)
                        else:
                            grant_item["url"] = response.url
                        
                        # Extract deadline information if available
                        deadline_date = card.xpath('./@deadlinedate').get()
                        deadline_label = card.xpath('./@deadlinelabel').get()
                        if deadline_date or deadline_label:
                            grant_item["dates"] = f"{deadline_label or 'Deadline'}: {deadline_date or 'TBD'}"
                        
                        yield grant_item
            else:
                self.logger.warning("Could not find 'Open' section on the page")
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

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
                grant_item["type"] = "private"
                grant_item["agency"] = "hhmi"
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
