import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime


class AlzheimersAssociationSpider(scrapy.Spider):
    """Spider for scraping neuroscience grants from Alzheimer's Association."""

    name = "alzheimers_association"
    start_urls = ["https://www.alz.org/research/for_researchers/grants/types-of-grants"]

    def parse(self, response):
        """Parse the main grants page for funding opportunities."""
        try:
            rows = response.xpath('//table//tr')
            self.logger.info(f"Found {len(rows)} rows in the table")
            
            for i, row in enumerate(rows):
                cells = row.xpath('.//td')
                if len(cells) < 3:
                    continue  # Skip header or malformed rows
                
                yield from self._extract_grant_from_row(cells, response, i)
            
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def _extract_grant_from_row(self, cells, response, row_index):
        """Extract grant information from a table row."""
        try:
            # Extract title and URL from first column
            title = cells[0].xpath('.//a/text()').get()
            if not title:
                return
            
            url = cells[0].xpath('.//a/@href').get()
            if url and not url.startswith('http'):
                url = response.urljoin(url)
            
            # Extract eligibility from second column
            eligibility_text = cells[1].xpath('string()').get().strip()
            
            # Extract dates from third column
            important_dates = cells[2].xpath('.//text()').getall()
            open_date = ' '.join([text.strip() for text in important_dates if text.strip()])
            
            grant_item = GrantscraperItem()
            grant_item["agency"] = "Alzheimer's Association"
            grant_item["type"] = "Private"
            grant_item["title"] = title.strip()
            grant_item["url"] = url if url else response.url
            grant_item["dates"] = open_date
            grant_item["eligibility"] = eligibility_text
            
            self.logger.info(f"Found grant: {title.strip()}")
            
            # Follow link to get detailed description
            if url:
                yield scrapy.Request(url, callback=self.parse_detail, meta={"item": grant_item})
            else:
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error extracting grant from row {row_index}: {e}")

    def parse_detail(self, response):
        """Parse detailed grant page for description."""
        grant_item = response.meta["item"]
        
        try:
            # Try to find description under the main title
            title_xpath = '//h1 | //h2 | //h3'
            title_elem = response.xpath(title_xpath)
            description = ""
            
            if title_elem:
                # Get the first <p> following the title
                description = title_elem.xpath('following-sibling::p[1]/text()').get()
            
            if not description:
                # Fallback: get the first <p> on the page
                description = response.xpath('//p/text()').get()
            
            grant_item["description"] = description.strip() if description else ""
            yield grant_item
            
        except Exception as e:
            self.logger.error(f"Error parsing detail page {response.url}: {e}")
            yield grant_item
