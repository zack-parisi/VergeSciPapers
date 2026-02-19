import scrapy
import json
from GrantScraper.items import GrantscraperItem


class GrantsSpider(scrapy.Spider):
    """Spider for scraping neuroscience grants from Grants.gov API."""

    name = "grantsgov"
    url = "https://api.grants.gov/v1/api/search2"
    page_size = 25

    def start_requests(self):
        """Generate initial requests to the Grants.gov API."""
        payload = {
            "keyword": "neuroscience OR brain OR neuro OR neurology OR neurobiology OR neuron",
            "oppStatuses": "forecasted|posted",
            "startRecordNum": 1,
            "pageSize": self.page_size
        }
        
        yield scrapy.Request(
            url=self.url,
            method="POST",
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            callback=self.parse,
            errback=self.handle_error,
            meta={"start_record": 1, "page_number": 1}
        )

    def parse(self, response):
        """Parse the JSON response from Grants.gov API."""
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON from {response.url}: {e}")
            return

        opps = data.get("data", {}).get("oppHits", [])
        hit_count = data.get("data", {}).get("hitCount", 0)
        current_record = response.meta["start_record"]
        page_number = response.meta["page_number"]
        
        self.logger.info(f"Page {page_number}: Found {len(opps)} opportunities (Total: {hit_count})")

        for item in opps:
            yield self._create_grant_item(item)

        # Handle pagination
        next_record = current_record + self.page_size
        if next_record <= hit_count:
            yield self._create_next_request(next_record, page_number + 1)
        else:
            self.logger.info(f"Completed pagination. Processed {hit_count} total opportunities.")

    def _create_grant_item(self, item):
        """Create a grant item from API data."""
        grant_item = GrantscraperItem()
        grant_item["title"] = item.get("title", "")
        grant_item["type"] = "Federal"
        grant_item["agency"] = item.get("agencyCode", "")
        grant_item["opportunityNumber"] = item.get("number", "")
        grant_item["url"] = f"https://www.grants.gov/search-results-detail/{item.get('id', '')}"
        
        # Extract dates
        open_date = item.get("openDate", "")
        close_date = item.get("closeDate", "")
        if open_date or close_date:
            if open_date and close_date:
                grant_item["dates"] = f"Open Date: {open_date}, Close Date: {close_date}"
            elif open_date:
                grant_item["dates"] = f"Open Date: {open_date}"
            else:
                grant_item["dates"] = f"Close Date: {close_date}"
        
        return grant_item

    def _create_next_request(self, start_record, page_number):
        """Create the next pagination request."""
        payload = {
            "keyword": "neuroscience OR brain OR neuro OR neurology OR neurobiology OR neuron",
            "oppStatuses": "forecasted|posted",
            "startRecordNum": start_record,
            "pageSize": self.page_size
        }
        
        return scrapy.Request(
            url=self.url,
            method="POST",
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            callback=self.parse,
            errback=self.handle_error,
            meta={"start_record": start_record, "page_number": page_number}
        )

    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
