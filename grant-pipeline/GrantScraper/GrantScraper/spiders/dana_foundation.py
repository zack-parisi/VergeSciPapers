import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class DanaFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Dana Foundation.
    Scrapes specific grant program pages for neuroscience-related funding opportunities.
    """
    name = "dana_foundation"
    start_urls = [
        "https://dana.org/dana-frontiers/",
        "https://dana.org/dana-nextgen/",
        "https://dana.org/dana-education/",
        "https://dana.org/brain-awareness-week-grants/"
    ]
    
    def parse(self, response):
        """Parse the grant program pages for funding opportunities."""
        try:
            # Extract the main title (large text at the top of the page)
            title = response.css('h1::text, .hero h1::text, .page-title::text').get()
            if not title:
                title = response.css('title::text').get()
            
            if title:
                grant_item = GrantscraperItem()
                grant_item["title"] = title.strip()
                grant_item["agency"] = "Dana Foundation"
                grant_item["type"] = "private"
                grant_item["url"] = response.url
                grant_item["dates"] = "Rolling"
                
                # Extract description based on URL
                if "dana-frontiers" in response.url:
                    grant_item["description"] = self._extract_frontiers_description(response)
                    grant_item["eligibility"] = self._extract_frontiers_eligibility(response)
                    grant_item["amount"] = "The majority of our grants are up to $150,000 in total funding for a project period of 12-18 months."
                
                elif "dana-nextgen" in response.url:
                    grant_item["description"] = self._extract_nextgen_description(response)
                    grant_item["eligibility"] = self._extract_nextgen_eligibility(response)
                    grant_item["amount"] = "The majority of our grants are up to $150,000 in total funding for a project period of 12-18 months."
                
                elif "dana-education" in response.url:
                    grant_item["description"] = self._extract_education_description(response)
                    grant_item["eligibility"] = self._extract_education_eligibility(response)
                    grant_item["amount"] = "The majority of our grants are up to $150,000 in total funding for a project period of 12-18 months."
                
                elif "brain-awareness-week-grants" in response.url:
                    grant_item["description"] = self._extract_baw_description(response)
                    grant_item["eligibility"] = "See site for information"
                    grant_item["amount"] = "Up to 1,250 USD is awarded to each successful proposal."
                
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error parsing page {response.url}: {e}")
    
    def _extract_frontiers_description(self, response):
        """Extract the first paragraph with <p> tags for Dana Frontiers."""
        description = response.css('p::text').get()
        if description:
            return description.strip()
        return "Dana Frontiers program supports multidirectional community engagement to collaboratively identify and address key issues at the intersection of neuroscience and society."
    
    def _extract_frontiers_eligibility(self, response):
        """Extract eligibility from FAQ section for Dana Frontiers."""
        # Look for the FAQ section about who can apply
        faq_text = response.text
        eligibility_match = re.search(r'Who can apply to receive a grant\?.*?Applicants must be designated as a tax-exempt organization', faq_text, re.DOTALL | re.IGNORECASE)
        if eligibility_match:
            return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
        return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
    
    def _extract_nextgen_description(self, response):
        """Extract the first paragraph with <p> tags for Dana NextGen."""
        description = response.css('p::text').get()
        if description:
            return description.strip()
        return "The Dana NextGen program aims to catalyze a new generation of interdisciplinary experts equipped to transform neuroscience and neurotechnology research and development by centering consideration of societal needs throughout the process."
    
    def _extract_nextgen_eligibility(self, response):
        """Extract eligibility from FAQ section for Dana NextGen."""
        # Look for the FAQ section about who can apply
        faq_text = response.text
        eligibility_match = re.search(r'Who can apply to receive a grant\?.*?Applicants must be designated as a tax-exempt organization', faq_text, re.DOTALL | re.IGNORECASE)
        if eligibility_match:
            return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
        return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
    
    def _extract_education_description(self, response):
        """Extract the first paragraph with <p> tags for Dana Education."""
        description = response.css('p::text').get()
        if description:
            return description.strip()
        return "Dana Education program description."
    
    def _extract_education_eligibility(self, response):
        """Extract eligibility from FAQ section for Dana Education."""
        # Look for the FAQ section about who can apply
        faq_text = response.text
        eligibility_match = re.search(r'Who can apply to receive a grant\?.*?Applicants must be designated as a tax-exempt organization', faq_text, re.DOTALL | re.IGNORECASE)
        if eligibility_match:
            return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
        return "Applicants must be designated as a tax-exempt organization under the provisions of 501(c)(3) of the United States Internal Revenue Code to be eligible for a grant."
    
    def _extract_baw_description(self, response):
        """Extract the first block of text including <p>, <ul>, and another <p> for Brain Awareness Week."""
        # Get the first paragraph
        first_p = response.css('p::text').get()
        # Get the first ul content
        first_ul = response.css('ul li::text').getall()
        # Get the second paragraph
        second_p_list = response.css('p::text').getall()
        second_p = ""
        if len(second_p_list) > 1:
            second_p = second_p_list[1]
        
        description_parts = []
        if first_p:
            description_parts.append(first_p.strip())
        if first_ul:
            description_parts.append(" ".join([item.strip() for item in first_ul[:3]]))  # First 3 list items
        if second_p:
            description_parts.append(second_p.strip())
        
        return " ".join(description_parts)
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
