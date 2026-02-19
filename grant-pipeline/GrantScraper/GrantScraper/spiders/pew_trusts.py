import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime
from w3lib.html import remove_tags

class PewTrustsSpider(scrapy.Spider):
    """
    Spider for scraping neuroscience grants from The Pew Charitable Trusts.
    Scrapes their current contract and grant opportunities page and filters for neuroscience-related grants.
    """
    name = "pew_trusts"
    start_urls = ["https://www.pew.org/en/about/current-contract-and-grant-opportunities"]
    
    # Neuroscience-related keywords for filtering
    neuroscience_keywords = [
        'neuroscience', 'neural', 'brain', 'cognitive', 'neurological', 'neurodegenerative',
        'alzheimer', 'parkinson', 'dementia', 'memory', 'learning', 'cognition',
        'neuropsychiatric', 'neurodevelopmental', 'autism', 'adhd', 'mental health',
        'psychiatric', 'psychology', 'behavioral', 'behavior', 'neuroimaging',
        'mri', 'fmri', 'eeg', 'electroencephalography', 'neurophysiology',
        'synapse', 'synaptic', 'neurotransmitter', 'dopamine', 'serotonin',
        'neuroplasticity', 'neurogenesis', 'neuroinflammation', 'stroke',
        'traumatic brain injury', 'tbi', 'epilepsy', 'seizure', 'neuropathic',
        'neuropathic pain', 'neurodegeneration', 'amyotrophic lateral sclerosis',
        'huntington', 'multiple sclerosis', 'ms', 'neuro-oncology',
        'brain tumor', 'glioblastoma', 'neuro-ophthalmology', 'neuro-otology',
        'neuro-cardiology', 'neuro-endocrinology', 'neuro-immunology',
        'neuromodulation', 'neurostimulation', 'deep brain stimulation',
        'neurofeedback', 'neurorehabilitation', 'neuroprosthetics'
    ]
    
    def parse(self, response):
        """Parse the main grants page for funding opportunities."""
        try:
            # Find all grant opportunities in the table
            # Look for table rows that contain grant information
            grant_rows = response.xpath('//table//tr[contains(., "Description:") or contains(., "Key Dates:")]')
            
            if not grant_rows:
                # Fallback: look for any table rows that might contain grants
                grant_rows = response.xpath('//table//tr[position()>1]')
            
            for row in grant_rows:
                try:
                    # Extract grant information from each row
                    grant_item = self._extract_grant_from_row(row, response)
                    if grant_item and self._is_neuroscience_related(grant_item):
                        yield grant_item
                        
                except Exception as e:
                    self.logger.error(f"Error parsing grant row: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def _is_neuroscience_related(self, grant_item):
        """Check if the grant is related to neuroscience based on title and description."""
        try:
            # Combine title and description for keyword search
            search_text = (grant_item.get('title', '') + ' ' + grant_item.get('description', '')).lower()
            
            # Check for neuroscience-related keywords with word boundaries
            for keyword in self.neuroscience_keywords:
                # Use word boundaries to avoid false positives
                pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
                if re.search(pattern, search_text):
                    self.logger.info(f"Grant '{grant_item.get('title', '')}' is neuroscience-related (keyword: {keyword})")
                    return True
            
            self.logger.info(f"Grant '{grant_item.get('title', '')}' is NOT neuroscience-related - excluding")
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking neuroscience relevance: {e}")
            return False

    def _extract_grant_from_row(self, row, response):
        """Extract grant information from a table row."""
        try:
            # Get the full text content of the row
            row_text = row.get()
            
            # Extract title (first bold text or first significant text)
            title = self._extract_title(row)
            if not title:
                return None
            
            # Extract description (text after "Description:")
            description = self._extract_description(row_text)
            
            # Extract dates (text after "Key Dates:")
            dates = self._extract_dates(row_text)
            
            # Extract contact information (text after "Contact:")
            contact = self._extract_contact(row_text)
            
            # Create grant item
            grant_item = GrantscraperItem()
            grant_item["title"] = title.strip()
            grant_item["description"] = self._clean_html(description) if description else ""
            grant_item["dates"] = self._clean_html(dates) if dates else ""
            grant_item["type"] = "Private"
            grant_item["agency"] = "The Pew Charitable Trusts"
            grant_item["url"] = response.url
            
            # Extract opportunity number if present in title or description
            opp_number = self._extract_opportunity_number(title + " " + (description or ""))
            if opp_number:
                grant_item["opportunityNumber"] = opp_number
            
            return grant_item
            
        except Exception as e:
            self.logger.error(f"Error extracting grant from row: {e}")
            return None
    
    def _extract_title(self, row):
        """Extract the grant title from the row."""
        try:
            # Look for the first significant text that could be a title
            # This is typically the first bold text or the first substantial text
            title_candidates = row.xpath('.//text()[normalize-space()]').getall()
            
            for candidate in title_candidates:
                candidate = candidate.strip()
                if candidate and len(candidate) > 10 and not candidate.startswith(('Description:', 'Key Dates:', 'Contact:', 'Type:', 'Downloads:')):
                    return candidate
            
            # Fallback: look for any text that looks like a title
            all_text = row.get()
            lines = all_text.split('\n')
            for line in lines:
                line = line.strip()
                if line and len(line) > 10 and not line.startswith(('Description:', 'Key Dates:', 'Contact:', 'Type:', 'Downloads:')):
                    return line
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting title: {e}")
            return None
    
    def _extract_description(self, text):
        """Extract description from text after 'Description:'."""
        try:
            description_match = re.search(r'Description:\s*(.*?)(?=Key Dates:|Contact:|Type:|Downloads:|$)', text, re.DOTALL | re.IGNORECASE)
            if description_match:
                return description_match.group(1).strip()
            return None
        except Exception as e:
            self.logger.error(f"Error extracting description: {e}")
            return None
    
    def _extract_dates(self, text):
        """Extract dates from text after 'Key Dates:'."""
        try:
            dates_match = re.search(r'Key Dates:\s*(.*?)(?=Contact:|Type:|Downloads:|$)', text, re.DOTALL | re.IGNORECASE)
            if dates_match:
                return dates_match.group(1).strip()
            return None
        except Exception as e:
            self.logger.error(f"Error extracting dates: {e}")
            return None
    
    def _extract_contact(self, text):
        """Extract contact information from text after 'Contact:'."""
        try:
            contact_match = re.search(r'Contact:\s*(.*?)(?=Key Dates:|Type:|Downloads:|$)', text, re.DOTALL | re.IGNORECASE)
            if contact_match:
                return contact_match.group(1).strip()
            return None
        except Exception as e:
            self.logger.error(f"Error extracting contact: {e}")
            return None
    
    def _clean_html(self, text):
        """Clean HTML tags from text."""
        if not text:
            return ""
        try:
            # Remove HTML tags
            cleaned = remove_tags(text)
            # Clean up extra whitespace
            cleaned = re.sub(r'\s+', ' ', cleaned)
            return cleaned.strip()
        except Exception as e:
            self.logger.error(f"Error cleaning HTML: {e}")
            return text.strip()
    
    def _extract_opportunity_number(self, text):
        """Extract opportunity number from text if present."""
        try:
            # Look for patterns like RFP, RFQ, or other opportunity identifiers
            opp_patterns = [
                r'\bRFP\s*[A-Z0-9-]+\b',
                r'\bRFQ\s*[A-Z0-9-]+\b',
                r'\b[A-Z]{2,4}-\d{4}\b',
                r'\b[A-Z0-9]{6,12}\b'
            ]
            
            for pattern in opp_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return match.group(0)
            
            return None
        except Exception as e:
            self.logger.error(f"Error extracting opportunity number: {e}")
            return None
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
