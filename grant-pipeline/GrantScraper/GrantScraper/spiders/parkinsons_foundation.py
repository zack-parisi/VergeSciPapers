import scrapy
from GrantScraper.items import GrantscraperItem

class ParkinsonsFoundationSpider(scrapy.Spider):
    """
    Spider for scraping grants from Parkinson's Foundation.
    Scrapes three specific pages for fellowship and award opportunities.
    """
    name = "parkinsons_foundation"
    start_urls = [
        "https://www.parkinson.org/advancing-research/for-researchers/fellowships-early-career-awards",
        "https://www.parkinson.org/advancing-research/for-researchers/awards-independent-investigators", 
        "https://www.parkinson.org/advancing-research/for-researchers/awards-for-institutions"
    ]
    
    def __init__(self):
        super().__init__()
        self.processed_grants = set()
    
    def parse(self, response):
        """Parse grant pages for detailed information."""
        self.logger.info(f"Parsing page: {response.url}")
        
        # Find all grant sections - look for h3 and h2 elements with IDs
        h3_grant_sections = response.xpath('//h3[@id]')
        h2_grant_sections = response.xpath('//h2[@id]')
        all_grant_sections = h3_grant_sections + h2_grant_sections
        
        for section in all_grant_sections:
            title = section.xpath('.//text()').get()
            if not title:
                continue
                
            title = title.strip()
            if len(title) < 3:
                continue
            
            # Find the parent article containing the heading
            parent_article = section.xpath('ancestor::article[1]')
            if not parent_article:
                continue
            
            # Find the accordion article that follows the parent article
            accordion_article = parent_article.xpath('following-sibling::article[@class="accordion"][1]')
            if not accordion_article:
                continue
            
            # Extract accordion items
            accordion_items = accordion_article.xpath('.//li[@class="accordion-item"]')
            
            description = ""
            amount = ""
            eligibility = ""
            
            for item in accordion_items:
                section_title = item.xpath('.//button//span/text()').get()
                if not section_title:
                    continue
                    
                section_title = section_title.strip()
                content = item.xpath('.//div[@class="accordion-content"]//text()').getall()
                content_text = ' '.join([text.strip() for text in content if text.strip()])
                
                if "Program Overview" in section_title:
                    description = content_text
                elif "Level of Support" in section_title:
                    amount = content_text
                elif "Eligibility and Restrictions" in section_title:
                    eligibility = content_text
            
            # Only create item if we have a valid title and some content
            if title and (description or amount or eligibility):
                # Check if we've already processed this grant
                if title in self.processed_grants:
                    continue
                
                self.processed_grants.add(title)
                
                grant_item = GrantscraperItem()
                grant_item["title"] = title
                grant_item["type"] = "Private"
                grant_item["agency"] = "Parkinson's Foundation"
                grant_item["description"] = description
                grant_item["amount"] = amount
                grant_item["eligibility"] = eligibility
                grant_item["url"] = response.url
                grant_item["dates"] = "Please see https://www.parkinson.org/advancing-research/for-researchers/award-deadlines"
                
                yield grant_item
