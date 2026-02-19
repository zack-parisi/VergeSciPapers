import scrapy
from GrantScraper.items import GrantscraperItem

class ERCSpider(scrapy.Spider):
    """Spider for scraping neuroscience grants from European Commission funding portal."""

    name = "erc"
    base_url = "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals"
    max_pages = 5

    def start_requests(self):
        """Generate initial requests to the European Commission funding portal."""
        params = {
            "order": "DESC",
            "pageNumber": 1,
            "pageSize": 50,
            "sortBy": "relevance",
            "keywords": "neuroscience",
            "isExactMatch": "true",
            "status": "31094501,31094502"
        }
        
        # Construct the full URL with parameters
        from urllib.parse import urlencode
        full_url = f"{self.base_url}?{urlencode(params)}"
        
        yield scrapy.Request(
            url=full_url,
            method="GET",
            callback=self.parse,
            errback=self.handle_error,
            meta={"page_number": 1},
            cb_kwargs={"params": params}
        )

    def parse(self, response, params):
        """Parse the HTML response from European Commission funding portal."""
        self.logger.info(f"Parsing page {response.meta['page_number']}")
        self.logger.info(f"Request URL: {response.url}")
        self.logger.info(f"Search parameters: {params}")
        
        # Find all grant boxes - they should be in containers with grant information
        grant_boxes = response.css('.opportunity-item, .call-item, .grant-item, [class*="opportunity"], [class*="call"]')
        
        if not grant_boxes:
            # Try alternative selectors if the above don't work
            grant_boxes = response.css('div[class*="box"], div[class*="card"], div[class*="item"]')
        
        self.logger.info(f"Found {len(grant_boxes)} potential grant boxes")
        
        extracted_count = 0
        for i, box in enumerate(grant_boxes):
            grant_item = self._extract_grant_from_box(box)
            if grant_item and grant_item.get("title"):
                extracted_count += 1
                self.logger.info(f"Extracted grant {extracted_count}: {grant_item.get('title', 'No title')[:50]}...")
                yield grant_item
            else:
                self.logger.debug(f"Skipped box {i+1}: No title or invalid data")
        
        self.logger.info(f"Successfully extracted {extracted_count} grants from {len(grant_boxes)} potential boxes")

        # Handle pagination
        if self._should_continue_pagination(response):
            yield self._create_next_request(response, params)

    def _extract_grant_from_box(self, box):
        """Extract grant information from a single grant box."""
        grant_item = GrantscraperItem()
        
        # Extract title and URL (title should be linked)
        title_text = None
        url = None
        
        # Try multiple approaches to find the title
        # First, look for linked titles
        title_link = box.css('a[href]').get()
        if title_link:
            title_text = box.css('a::text').get()
            url = box.css('a::attr(href)').get()
        
        # If no linked title found, try other selectors
        if not title_text:
            title_text = box.css('h1::text, h2::text, h3::text, h4::text, h5::text, h6::text').get()
        
        if not title_text:
            title_text = box.css('.title::text, [class*="title"]::text').get()
        
        if not title_text:
            title_text = box.css('strong::text, b::text').get()
        
        # Clean up title text
        if title_text:
            title_text = title_text.strip()
            # Skip very short or empty titles
            if len(title_text) < 3:
                title_text = None
        
        if title_text:
            grant_item["title"] = title_text
            
            # Process URL if found
            if url:
                if url.startswith('/'):
                    grant_item["url"] = f"https://ec.europa.eu{url}"
                elif url.startswith('http'):
                    grant_item["url"] = url
                else:
                    grant_item["url"] = f"https://ec.europa.eu{url}"
        
        # Extract dates - look for text containing "Opening date" and "Deadline date"
        date_text = box.css('::text').getall()
        dates_found = []
        
        for text in date_text:
            text = text.strip()
            if text and ('Opening date:' in text or 'Deadline date:' in text or 'Closing date:' in text):
                dates_found.append(text)
        
        if dates_found:
            # Join all date information
            grant_item["dates"] = ' | '.join(dates_found)
        
        # Set fixed values
        grant_item["agency"] = "ERC"
        grant_item["type"] = "Public"
        
        # Try to extract opportunity number from URL or other elements
        opportunity_number = box.css('[class*="number"], [class*="id"], [class*="ref"]::text').get()
        if opportunity_number:
            grant_item["opportunityNumber"] = opportunity_number.strip()
        
        return grant_item

    def _should_continue_pagination(self, response):
        """Check if pagination should continue."""
        page_number = response.meta["page_number"]
        if page_number >= self.max_pages:
            self.logger.info(f"Reached max pages ({self.max_pages}). Stopping spider.")
            return False
        
        # Check if there's a next page link
        next_page = response.css('a[class*="next"], a[class*="more"], .pagination a:contains("Next")').get()
        return next_page is not None

    def _create_next_request(self, response, params):
        """Create the next pagination request."""
        page_number = response.meta["page_number"]
        next_page_number = page_number + 1
        
        params["pageNumber"] = next_page_number
        
        # Construct the full URL with parameters
        from urllib.parse import urlencode
        full_url = f"{self.base_url}?{urlencode(params)}"
        
        return scrapy.Request(
            url=full_url,
            method="GET",
            callback=self.parse,
            errback=self.handle_error,
            meta={"page_number": next_page_number},
            cb_kwargs={"params": params}
        )

    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}") 