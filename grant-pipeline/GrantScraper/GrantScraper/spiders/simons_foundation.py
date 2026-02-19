import scrapy
import json
from GrantScraper.items import GrantscraperItem


class SimonsFoundationSpider(scrapy.Spider):
    """Spider for scraping neuroscience grants from Simons Foundation funding opportunities page."""

    name = "simons_foundation"
    start_urls = ["https://www.simonsfoundation.org/funding-opportunities/?term=&type=ns"]

    def parse(self, response):
        """Parse the Simons Foundation funding opportunities page."""
        self.logger.info(f"Parsing page: {response.url}")
        
        # Find all grant entries on the page
        # Based on the actual HTML structure, look for article elements with m-post class
        grant_entries = response.css('article.m-post')
        
        # If no specific grant containers found, try alternative selectors
        if not grant_entries:
            grant_entries = response.css('div[class*="grant"], div[class*="opportunity"], div[class*="funding"], article, .grant-item, .opportunity-item')
        
        # If still no entries found, try a more general approach
        if not grant_entries:
            grant_entries = response.css('div, article, section')
            self.logger.info("Using fallback selector - found {} potential containers".format(len(grant_entries)))
        
        self.logger.info(f"Found {len(grant_entries)} potential grant entries")
        
        # Track processed titles to avoid duplicates
        processed_titles = set()
        
        for entry in grant_entries:
            # Skip entries that are too small or don't contain grant-like content
            entry_text = entry.get()
            if len(entry_text) < 50:  # Skip very small entries
                continue
                
            # Check if entry contains grant-related keywords
            grant_keywords = ['grant', 'funding', 'opportunity', 'award', 'fellowship', 'research']
            if not any(keyword in entry_text.lower() for keyword in grant_keywords):
                continue
                
            grant_item = self._extract_grant_data(entry, response)
            if grant_item and grant_item.get('title'):
                # Check for duplicates
                title = grant_item.get('title', '').strip()
                if title and title not in processed_titles:
                    # Filter out closed grants
                    dates = grant_item.get('dates', '')
                    if dates and 'closed' in dates.lower():
                        self.logger.info(f"Skipping closed grant: {title}")
                        continue
                    
                    processed_titles.add(title)
                    yield grant_item

    def _extract_grant_data(self, entry, response):
        """Extract grant data from a single entry element."""
        try:
            # Extract title (larger font, linked)
            title_elements = entry.css('h3 a, h4 a, .title a, a[href*="/grants/"], a[href*="/funding/"]')
            title_element = title_elements[0] if title_elements else None
            if not title_element:
                title_elements = entry.css('h3, h4, .title, strong a, b a')
                title_element = title_elements[0] if title_elements else None
            
            title = ""
            if title_element:
                title = title_element.get().strip()
                # Clean up HTML tags if present
                import re
                title = re.sub(r'<[^>]+>', '', title)
                
                # If title is still empty, try to get text content
                if not title:
                    title = title_element.css('::text').get().strip()
                
                # Clean up HTML entities and extra whitespace
                import html
                title = html.unescape(title)
                title = re.sub(r'\s+', ' ', title).strip()
            
            # Extract URL from title link
            url = ""
            if title_element and title_element.attrib.get('href'):
                url = response.urljoin(title_element.attrib['href'])
            
            # Extract description from the m-post__main div
            description = ""
            desc_elements = entry.css('.m-post__main')
            desc_element = desc_elements[0] if desc_elements else None
            
            if desc_element:
                desc_text = desc_element.get().strip()
                # Clean up HTML tags
                import re
                desc_text = re.sub(r'<[^>]+>', '', desc_text)
                # Clean up HTML entities and extra whitespace
                import html
                desc_text = html.unescape(desc_text)
                desc_text = re.sub(r'\s+', ' ', desc_text).strip()
                description = desc_text
            else:
                # Fallback: try other selectors
                desc_selectors = [
                    '.description', '.summary', '.content',
                    'p',  # Paragraphs
                    'div'  # Divs
                ]
                
                for selector in desc_selectors:
                    desc_elements = entry.css(selector)
                    if desc_elements:
                        desc_element = desc_elements[0]
                        desc_text = desc_element.get().strip()
                        # Clean up HTML tags
                        import re
                        desc_text = re.sub(r'<[^>]+>', '', desc_text)
                        # Clean up HTML entities and extra whitespace
                        import html
                        desc_text = html.unescape(desc_text)
                        desc_text = re.sub(r'\s+', ' ', desc_text).strip()
                        if desc_text and len(desc_text) > 20:  # Only use if it's substantial
                            description = desc_text
                            break
            
            # Clean up description
            if description:
                import re
                import html
                
                # Clean up HTML entities and whitespace
                description = html.unescape(description)
                description = re.sub(r'\s+', ' ', description).strip()
                
                # Remove title from description if it appears at the beginning
                if title:
                    title_clean = title.strip()
                    if description.startswith(title_clean):
                        description = description[len(title_clean):].strip()
                
                # Remove status-related text that might have been included
                status_patterns = [
                    r'Program Area:.*?Status:.*',
                    r'Career Stage:.*?Status:.*',
                    r'Program Area:.*?$',
                    r'Career Stage:.*?$',
                    r'Status:.*?$',
                    r'Read More.*?$'
                ]
                
                for pattern in status_patterns:
                    description = re.sub(pattern, '', description, flags=re.IGNORECASE)
                
                # Final cleanup
                description = re.sub(r'\s+', ' ', description).strip()
            
            # Extract dates from Status section (right side)
            dates = ""
            # Look for status information in the m-post__aside section
            status_selectors = [
                '.m-post__aside',  # Primary target
                '[class*="status"]', '[class*="date"]', '.status', '.dates',
                '[class*="closed"]', '[class*="open"]',
                'span', 'div'  # Look in all spans and divs for status info
            ]
            
            # Also look for status text patterns
            status_patterns = [
                r'Status\s*-\s*(.+)',
                r'Career Stage\s*-\s*(.+)',
                r'Program Area\s*-\s*(.+)',
                r'(Closed|Open|Deadline)',
                r'(\d{1,2}/\d{1,2}/\d{4})',
                r'(\d{4}-\d{2}-\d{2})'
            ]
            
            for selector in status_selectors:
                status_sections = entry.css(selector)
                if status_sections:
                    status_section = status_sections[0]
                    status_text = status_section.get()
                    if status_text:
                        # Clean up HTML tags
                        import re
                        status_text = re.sub(r'<[^>]+>', '', status_text)
                        
                        # Look for status patterns in the text
                        for pattern in status_patterns:
                            matches = re.findall(pattern, status_text, re.IGNORECASE)
                            if matches:
                                if 'status' in pattern.lower():
                                    dates = f"Status: {matches[0]}"
                                elif 'career' in pattern.lower():
                                    dates = f"Career Stage: {matches[0]}"
                                elif 'program' in pattern.lower():
                                    dates = f"Program Area: {matches[0]}"
                                elif 'closed' in pattern.lower() or 'open' in pattern.lower():
                                    dates = f"Status: {matches[0]}"
                                else:
                                    dates = ", ".join(matches)
                                break
                        
                        # If no status found, check for status keywords
                        if not dates and any(keyword in status_text.lower() for keyword in ['closed', 'open', 'deadline']):
                            dates = f"Status: {status_text.strip()}"
                            break
            
            # Create grant item
            grant_item = GrantscraperItem()
            grant_item["title"] = title
            grant_item["agency"] = "Simons Foundation"
            grant_item["type"] = "Private"
            grant_item["description"] = description
            grant_item["dates"] = dates
            grant_item["url"] = url
            grant_item["opportunityNumber"] = ""  # Will be extracted from URL if available
            
            # Extract opportunity number from URL if possible
            if url:
                import re
                url_match = re.search(r'/grants/([^/]+)', url)
                if url_match:
                    grant_item["opportunityNumber"] = url_match.group(1)
                else:
                    # Try other URL patterns
                    url_match = re.search(r'/funding/([^/]+)', url)
                    if url_match:
                        grant_item["opportunityNumber"] = url_match.group(1)
            
            # Log successful extraction
            if title:
                self.logger.info(f"Extracted grant: {title[:50]}...")
            
            return grant_item
            
        except Exception as e:
            self.logger.error(f"Error extracting grant data: {e}")
            return None 