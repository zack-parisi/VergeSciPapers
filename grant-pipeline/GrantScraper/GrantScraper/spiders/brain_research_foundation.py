import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class BrainResearchFoundationSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from Brain Research Foundation.
    Scrapes their Scientific Innovations Award and Seed Grants pages.
    """
    name = "brain_research_foundation"
    start_urls = [
        "https://www.thebrf.org/scientific-innovations-award/",
        "https://www.thebrf.org/seed-grants/"
    ]
    
    def parse(self, response):
        """Parse the grant pages for funding opportunities."""
        try:
            # Extract the main title (h1)
            title = response.css('h1::text').get()
            if not title:
                # Try alternative selectors for title
                title = response.css('h1 *::text').get()
            if not title:
                title = response.css('title::text').get()
            
            # If still no title or title is just whitespace, try to extract from URL or page content
            if not title or not title.strip():
                if "scientific-innovations-award" in response.url:
                    title = "Scientific Innovations Award"
                elif "seed-grants" in response.url:
                    title = "Seed Grants"
                else:
                    title = "Brain Research Foundation Grant"
            
            if title and title.strip():
                grant_item = GrantscraperItem()
                grant_item["title"] = title.strip()
                grant_item["type"] = "Private"
                grant_item["agency"] = "Brain Research Foundation"
                grant_item["url"] = response.url
                
                # Extract description (content after title, before next bold heading)
                description = self._extract_description(response)
                if description:
                    grant_item["description"] = description
                
                # Extract dates (after the next bold heading)
                dates = self._extract_dates(response)
                if dates:
                    grant_item["dates"] = dates
                
                # Extract eligibility (underlined text after dates)
                eligibility = self._extract_eligibility(response)
                if eligibility:
                    grant_item["eligibility"] = eligibility
                
                yield grant_item
                
        except Exception as e:
            self.logger.error(f"Error parsing page {response.url}: {e}")
    
    def _extract_description(self, response):
        """Extract description content between title and next bold heading."""
        try:
            # For BRF pages, the description is typically the first paragraph after the h1
            # Look for the first paragraph that contains meaningful content
            description = response.css('h1 + p::text, h1 + div p::text').get()
            if not description:
                # Fallback: get the first substantial paragraph
                paragraphs = response.css('p::text').getall()
                for p in paragraphs:
                    if p.strip() and len(p.strip()) > 50:  # Meaningful content
                        description = p.strip()
                        break
            
            return description if description else None
            
        except Exception as e:
            self.logger.error(f"Error extracting description: {e}")
            return None
    
    def _extract_dates(self, response):
        """Extract dates from the page content - the sentence above eligibility."""
        try:
            # Get the text content without HTML tags
            text_content = response.css('body ::text').getall()
            full_text = ' '.join([text.strip() for text in text_content if text.strip()])
            
            # Find the eligibility line first
            eligibility_pattern = r'If your institution did not receive an invitation directly from BRF via e-mail'
            eligibility_match = re.search(eligibility_pattern, full_text)
            
            if eligibility_match:
                # Get the text before the eligibility line
                before_eligibility = full_text[:eligibility_match.start()]
                
                # Look for the specific date sentences based on the web search results
                date_patterns = [
                    r'The \d{4} Scientific Innovations Award \(SIA\) opens on \w+ \d{1,2}, \d{4}',
                    r'The \d{4} Seed Grant Letter of Intent round will open on \w+, \w+ \d{1,2}, \d{4}',
                    r'opens on \w+ \d{1,2}, \d{4}',
                    r'will open on \w+ \d{1,2}, \d{4}'
                ]
                
                for pattern in date_patterns:
                    match = re.search(pattern, before_eligibility, re.IGNORECASE)
                    if match:
                        return f"{match.group(0)}"
                
                # Fallback: find the last sentence before eligibility that contains date keywords
                sentences = re.split(r'[.!?]', before_eligibility)
                for sentence in reversed(sentences):
                    sentence = sentence.strip()
                    if (sentence and len(sentence) > 20 and 
                        any(keyword in sentence.lower() for keyword in ['open', 'opens', 'will open', 'available', 'deadline', '2025', '2026'])):
                        # Clean up the sentence
                        sentence = re.sub(r'\s+', ' ', sentence).strip()
                        return f"{sentence}"
            
            # Fallback: try to find any date-related sentence in the full text
            date_sentences = re.findall(r'([^.!?]*(?:opens?|will open|available|deadline)[^.!?]*[.!?])', full_text, re.IGNORECASE)
            if date_sentences:
                return f"{date_sentences[0].strip()}"
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting dates: {e}")
            return None
    
    def _extract_eligibility(self, response):
        """Extract eligibility information."""
        try:
            # Look for eligibility information in the page
            # Based on the web search results, eligibility is often in specific sections
            
            # First try to find text near eligibility keywords
            eligibility_sections = response.xpath('//*[contains(text(), "eligibility") or contains(text(), "eligible") or contains(text(), "requirements") or contains(text(), "must be")]//text()').getall()
            
            if eligibility_sections:
                # Get the most relevant eligibility text
                for section in eligibility_sections:
                    if section.strip() and len(section.strip()) > 20:
                        return section.strip()
            
            # Fallback: look for underlined text
            eligibility = response.css('u::text, .underline::text, [style*="underline"]::text').get()
            
            return eligibility if eligibility else None
            
        except Exception as e:
            self.logger.error(f"Error extracting eligibility: {e}")
            return None
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
