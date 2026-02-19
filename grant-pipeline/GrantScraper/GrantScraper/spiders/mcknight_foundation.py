import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class McKnightFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from McKnight Endowment Fund.
    Uses Selenium to bypass anti-bot protection.
    """
    name = "mcknight_foundation"
    start_urls = ["https://www.mcknight.org/programs/the-mcknight-endowment-fund-for-neuroscience/"]
    
    def start_requests(self):
        """Start the spider from the main page to discover grant links."""
        for url in self.start_urls:
            yield scrapy.Request(
                url=url,
                callback=self.parse_main_page,
                dont_filter=True
            )
    
    def parse_main_page(self, response):
        """Parse the main page to discover grant links from the boxes."""
        try:
            # Look for grant boxes based on the actual HTML structure
            # Grants are in wpb_wrapper divs with grant descriptions
            grant_links = []
            
            # Find all wpb_wrapper divs that contain grant links with descriptions
            grant_boxes = response.xpath('//div[contains(@class, "wpb_wrapper")]')
            
            for box in grant_boxes:
                # Find links in this box
                links = box.xpath('.//a[@href]')
                
                for link in links:
                    href = link.xpath('@href').get()
                    # Use string() to get full text content including child elements
                    text = link.xpath('string()').get()
                    
                    if href and text:
                        href = response.urljoin(href)
                        text = text.strip()
                        
                        # Check if this is a grant link with description (longer text)
                        if (any(keyword in href.lower() for keyword in ['award', 'scholar']) and
                            'neuroscience' in href.lower() and
                            len(text) > 50 and  # Has description
                            'news-ideas' not in href.lower()):  # Not a news link
                            
                            grant_links.append(href)
            
            # Remove duplicates while preserving order
            unique_grant_links = list(dict.fromkeys(grant_links))
            
            self.logger.info(f"Found {len(unique_grant_links)} grant links from boxes: {unique_grant_links}")
            
            # Follow each grant link
            for link in unique_grant_links:
                yield scrapy.Request(
                    url=link,
                    callback=self.parse_grant_page,
                    dont_filter=True
                )
                        
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")
    
    def parse_grant_page(self, response):
        """Parse individual grant pages."""
        try:
            # Extract the main title - first h1 on the page
            title = response.xpath('//h1/text()').get()
            if not title:
                # Fallback to page title
                title = response.xpath('//title/text()').get()
                if title:
                    # Clean up the title (remove " - McKnight Foundation" suffix)
                    title = title.replace(' - McKnight Foundation', '').strip()
            
            if title:
                title = title.strip()
                
                # Extract description - look for the p tag with class 'selectionShareable'
                description = ""
                
                # First try to find the p tag with class 'selectionShareable'
                selection_paragraphs = response.xpath('//p[@class="selectionShareable"]')
                
                if selection_paragraphs:
                    # Get the complete text from the first selectionShareable paragraph
                    description = selection_paragraphs[0].xpath('string()').get()
                else:
                    # Fallback: look for any text that starts with "The McKnight"
                    all_text = response.xpath('//text()').getall()
                    for text in all_text:
                        text = text.strip()
                        if text and text.startswith('The McKnight') and len(text) > 100:
                            description = text
                            break
                
                # Clean up the description
                if description:
                    description = description.strip()
                
                # Create grant item
                grant_item = GrantscraperItem()
                grant_item["title"] = title
                grant_item["description"] = description
                grant_item["type"] = "Private"
                grant_item["agency"] = "The McKnight Endowment Fund for Neuroscience"
                grant_item["url"] = response.url
                # Leave dates field blank as dates are not clearly written on the sites
                
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error parsing grant page {response.url}: {e}") 