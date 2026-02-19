import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class KavliFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Kavli Foundation.
    Scrapes their funding opportunities page for currently open neuroscience-related funding opportunities.
    """
    name = "kavli_foundation"
    start_urls = ["https://www.kavlifoundation.org/funding-opportunities"]
    
    def parse(self, response):
        """Parse the funding opportunities page for currently open neuroscience grants."""
        try:
            # Look for grant articles - these are the actual grant listings
            # Use a more general selector to catch all grant articles
            grant_articles = response.xpath('//article[contains(@class, "grid")]')
            
            self.logger.info(f"Found {len(grant_articles)} grant articles")
            
            for article in grant_articles:
                # Check if this is an open grant by looking at the date text
                # Open grants do NOT contain "Closed" or "CLOSED" in the date
                date_element = article.xpath('.//p[contains(@class, "bg-marine-100")]')
                
                # Check if the date element indicates a closed grant
                is_open_grant = True  # Default to open unless we find "Closed"
                if date_element:
                    date_text = date_element.xpath('./text()').get()
                    
                    if date_text:
                        date_text_lower = date_text.lower().strip()
                        # If the date contains "closed" (case insensitive), it's a closed grant
                        if 'closed' in date_text_lower:
                            is_open_grant = False
                
                # Only process open grants
                if is_open_grant:
                    # Check if this is a neuroscience grant by looking at the program field
                    # The program is on the right side with "Program" as the heading
                    program_selectors = [
                        './/dt[contains(text(), "Program")]/following-sibling::dd[1]//text()',
                        './/dt[contains(text(), "Program")]/following-sibling::dd[1]/text()',
                        './/dd[contains(text(), "Neuroscience")]/text()'
                    ]
                    
                    is_neuroscience_grant = False
                    for selector in program_selectors:
                        program_element = article.xpath(selector).get()
                        if program_element:
                            program_text = program_element.strip()
                            # Check if the program contains "Neuroscience"
                            if 'neuroscience' in program_text.lower():
                                is_neuroscience_grant = True
                                break
                    
                    # Only process neuroscience grants
                    if is_neuroscience_grant:
                        # Extract grant information from each article
                        title_element = article.xpath('.//h1/a/text()').get()
                        title_url = article.xpath('.//h1/a/@href').get()
                        
                        if title_element and title_element.strip():
                            grant_item = GrantscraperItem()
                            grant_item["title"] = title_element.strip()
                            grant_item["type"] = "Private"
                            grant_item["agency"] = "Kavli Foundation"
                            
                            # Set URL to the full URL if available
                            if title_url:
                                grant_item["url"] = response.urljoin(title_url)
                            else:
                                grant_item["url"] = response.url
                            
                            # Extract deadline/date information - try multiple selectors
                            deadline_selectors = [
                                './/p[contains(@class, "bg-marine-100")]/text()',
                                './/p[contains(text(), "Deadline")]/text()'
                            ]
                            
                            for selector in deadline_selectors:
                                deadline_text = article.xpath(selector).get()
                                if deadline_text and deadline_text.strip():
                                    grant_item["dates"] = deadline_text.strip()
                                    break
                            
                            # Extract amount from the right side - try multiple approaches
                            amount_selectors = [
                                './/dt[contains(text(), "Amount")]/following-sibling::dd[1]//text()',
                                './/dt[contains(text(), "Amount")]/following-sibling::dd[1]/text()',
                                './/dd[contains(text(), "$")]/text()',
                                './/dd[contains(text(), "Up to")]/text()'
                            ]
                            
                            for selector in amount_selectors:
                                amount_element = article.xpath(selector).get()
                                if amount_element and amount_element.strip():
                                    grant_item["amount"] = amount_element.strip()
                                    break
                            
                            # Extract description - try multiple selectors
                            description_selectors = [
                                './/div[contains(@class, "max-w-content")]//p/text()',
                                './/div[contains(@class, "css-1l2h9r4")]//p/text()',
                                './/p[contains(text(), "The Kavli Foundation")]/text()'
                            ]
                            
                            for selector in description_selectors:
                                description_element = article.xpath(selector).get()
                                if description_element and description_element.strip():
                                    grant_item["description"] = description_element.strip()
                                    break
                            
                            self.logger.info(f"Extracted OPEN NEUROSCIENCE grant: {grant_item['title']}")
                            yield grant_item
                        else:
                            self.logger.warning(f"No title found in open neuroscience grant article: {article.get()[:200]}")
                    else:
                        # Log non-neuroscience grants for debugging
                        title_element = article.xpath('.//h1/a/text()').get()
                        if title_element:
                            self.logger.info(f"Skipping non-NEUROSCIENCE grant: {title_element.strip()}")
                else:
                    # Log closed grants for debugging
                    title_element = article.xpath('.//h1/a/text()').get()
                    if title_element:
                        self.logger.info(f"Skipping CLOSED grant: {title_element.strip()}")
            
            # Also look for any direct links to grant pages (but only for open neuroscience grants)
            grant_links = response.css('a[href*="grant"], a[href*="funding"], a[href*="award"]::attr(href)').getall()
            
            for link in grant_links:
                if link and not link.startswith('#') and not link.startswith('javascript:'):
                    yield response.follow(link, self.parse_grant_page, errback=self.handle_error)
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def parse_grant_page(self, response):
        """Parse individual grant pages for detailed information."""
        try:
            # Extract detailed grant information
            title = response.css('h1::text, h2::text').get()
            if not title:
                title = response.css('title::text').get()
            
            if title and any(keyword in title.lower() for keyword in ['neuroscience', 'brain', 'research', 'grant', 'funding', 'award']):
                grant_item = GrantscraperItem()
                grant_item["title"] = title.strip()
                grant_item["type"] = "Private"
                grant_item["agency"] = "Kavli Foundation"
                grant_item["url"] = response.url
                
                # Extract dates from the page content
                content = response.get()
                self._extract_dates(grant_item, content)
                
                # Extract amount information
                amount_selectors = [
                    '//text()[contains(., "Amount")]',
                    '//text()[contains(., "$")]',
                    '//text()[contains(., "Up to")]',
                    '//text()[contains(., "funding")]'
                ]
                
                for selector in amount_selectors:
                    amounts = response.xpath(selector).getall()
                    if amounts:
                        amount_text = ' '.join([a.strip() for a in amounts if a.strip()])
                        if amount_text:
                            grant_item["amount"] = amount_text
                            break
                
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error parsing grant page {response.url}: {e}")
    
    def _extract_dates(self, grant_item, content):
        """Extract dates from content using regex patterns."""
        try:
            date_patterns = [
                r'(\d{1,2}/\d{1,2}/\d{4})',
                r'(\d{4}-\d{2}-\d{2})',
                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}',
                r'(Deadline:\s*[A-Za-z]+\s+\d{1,2},?\s+\d{4})',
                r'(Closed\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4})'
            ]
            for pattern in date_patterns:
                dates = re.findall(pattern, content)
                if dates:
                    if len(dates) > 1:
                        grant_item["dates"] = f"Open Date: {dates[0]}, Close Date: {dates[1]}"
                    else:
                        grant_item["dates"] = f"Deadline: {dates[0]}"
                    break
        except Exception as e:
            self.logger.error(f"Error extracting dates: {e}")
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
