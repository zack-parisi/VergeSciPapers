import scrapy
from GrantScraper.items import GrantscraperItem
import re
from datetime import datetime

class AmericanHeartSpider(scrapy.Spider):
    """
    Spider for scraping funding opportunities from American Heart Association.
    Scrapes their grants page for funding opportunities from the tables.
    """
    name = "american_heart"
    start_urls = ["https://professional.heart.org/en/research-programs/aha-funding-opportunities"]
    
    def __init__(self, *args, **kwargs):
        super(AmericanHeartSpider, self).__init__(*args, **kwargs)
        self.seen_titles = set()  # Track seen titles to avoid duplicates
    
    def parse(self, response):
        """Parse the main grants page for funding opportunities from tables."""
        try:
            # First, find all tables on the page
            all_tables = response.xpath('//table')
            self.logger.info(f"Found {len(all_tables)} total tables on the page")
            
            # Parse each table individually
            for i, table in enumerate(all_tables):
                self.logger.info(f"Processing table {i+1}/{len(all_tables)}")
                yield from self._parse_any_table(table, response, f"Table {i+1}")
            
            # Parse Investigator-initiated Research Opportunities table (specific method)
            yield from self._parse_research_opportunities_table(response)
            
            # Parse Topic-focused Funding Opportunities table
            yield from self._parse_topic_focused_table(response)
            
            # Parse Data Science Grants table
            yield from self._parse_data_science_table(response)
            
            # Parse AHA Registry Research table
            yield from self._parse_registry_research_table(response)
            
            # Fallback: try to find any grant-related content if tables weren't found
            yield from self._fallback_parse(response)
            
            # Log summary of what we found
            self.logger.info(f"Spider completed. Found {len(self.seen_titles)} unique grants: {list(self.seen_titles)}")
                    
        except Exception as e:
            self.logger.error(f"Error parsing main page {response.url}: {e}")

    def _parse_any_table(self, table, response, table_name):
        """Parse any table for grant opportunities."""
        try:
            rows = table.xpath('.//tr')
            self.logger.info(f"{table_name}: Found {len(rows)} rows")
            
            if len(rows) == 0:
                return
            
            # Log the first few rows to understand the table structure
            for i, row in enumerate(rows[:3]):
                row_text = row.xpath('.//text()').getall()
                row_text = ' '.join([text.strip() for text in row_text if text.strip()])
                self.logger.info(f"{table_name} Row {i}: {row_text[:100]}...")
            
            # Process each row
            for i, row in enumerate(rows):
                grant_item = self._extract_grant_from_row(row, response, "American Heart Association")
                if grant_item:
                    self.logger.info(f"{table_name} Row {i} produced grant: {grant_item['title']}")
                    yield grant_item
                    
        except Exception as e:
            self.logger.error(f"Error parsing {table_name}: {e}")

    def _fallback_parse(self, response):
        """Fallback method to find grant opportunities if table parsing fails."""
        try:
            # Look for any grant-related links or content
            grant_links = response.xpath('//a[contains(@href, "grant") or contains(@href, "funding") or contains(@href, "award")]')
            
            for link in grant_links:
                title = link.xpath('.//text()').get()
                href = link.xpath('@href').get()
                
                if title and href:
                    # Clean the title
                    title = re.sub(r'<[^>]+>', '', title)
                    title = re.sub(r'\s+', ' ', title).strip()
                    
                    # Skip if title is too short or contains unwanted content
                    skip_keywords = [
                        'awards & lectures', 'awardee resources', 'see data', 
                        'funding opportunities', 'autism speaks', 'proposal deadline:',
                        'deadline for', 'novel pilot program', 'jointly funded',
                        'read more', 'learn more', 'view more', 'scientific sessions',
                        'conference', 'meeting', 'symposium'
                    ]
                    
                    # Check for exact matches that should be skipped
                    exact_skip_titles = [
                        'read more', 'learn more', 'view more', 'scientific sessions 2025',
                        'scientific sessions', 'read more about', 'learn more about'
                    ]
                    
                    if len(title) < 5 or any(skip in title.lower() for skip in skip_keywords):
                        continue
                    
                    # Check for exact title matches that should be skipped
                    if title.lower().strip() in exact_skip_titles:
                        continue
                    
                    # Check for duplicates
                    if title in self.seen_titles:
                        continue
                    
                    # Only include if it's a specific grant page, not a general page
                    if any(keyword in href.lower() for keyword in ['grant', 'funding', 'award', 'fellowship']):
                        grant_item = GrantscraperItem()
                        grant_item["title"] = title
                        grant_item["type"] = "Private"
                        grant_item["agency"] = "American Heart Association"
                        grant_item["url"] = response.urljoin(href)
                        
                        self.seen_titles.add(title)
                        yield grant_item
                    
        except Exception as e:
            self.logger.error(f"Error in fallback parse: {e}")

    def _parse_research_opportunities_table(self, response):
        """Parse the Investigator-initiated Research Opportunities table."""
        try:
            # Find the table that contains "Investigator-initiated Research Opportunities"
            # Try multiple approaches to find the table
            table = None
            
            # Approach 1: Look for table with the specific text
            table = response.xpath('//table[.//text()[contains(., "Investigator-initiated Research Opportunities")]]')
            
            # Approach 2: Look for heading followed by table
            if not table:
                table = response.xpath('//*[contains(text(), "Investigator-initiated Research Opportunities")]/following-sibling::table[1]')
            
            # Approach 3: Look for table with specific grant names
            if not table:
                table = response.xpath('//table[.//text()[contains(., "Career Development Award") or contains(., "Innovative Project Award") or contains(., "AHA Predoctoral Fellowship")]]')
            
            # Approach 4: Look for any table with grant-related content
            if not table:
                table = response.xpath('//table[.//text()[contains(., "Award") or contains(., "Grant") or contains(., "Research") or contains(., "Fellowship")]]')
            
            # Approach 5: Look for table with specific structure
            if not table:
                table = response.xpath('//table[@class="table table-striped"]')
            
            if table:
                self.logger.info(f"Found research opportunities table with {len(table)} tables")
                rows = table.xpath('.//tr')  # Get all rows, not just after header
                self.logger.info(f"Found {len(rows)} rows in research opportunities table")
                
                for i, row in enumerate(rows):
                    # Debug: Log all rows to see what's being processed
                    row_text = row.xpath('.//text()').getall()
                    row_text = ' '.join([text.strip() for text in row_text if text.strip()])
                    self.logger.info(f"Row {i}: {row_text[:150]}...")
                    
                    grant_item = self._extract_grant_from_row(row, response, "American Heart Association")
                    if grant_item:
                        self.logger.info(f"Row {i} produced grant: {grant_item['title']}")
                        yield grant_item
                    else:
                        # Debug: Log when a row doesn't produce a grant item
                        if any(grant_name in row_text for grant_name in ['AHA Predoctoral Fellowship', 'AHA Postdoctoral Fellowship', 'Career Development Award', 'Innovative Project Award', 'Institutional Award', 'AIREA']):
                            self.logger.warning(f"Row {i} did not produce a grant item: {row_text[:150]}...")
            else:
                self.logger.warning("Could not find Investigator-initiated Research Opportunities table")
                        
        except Exception as e:
            self.logger.error(f"Error parsing research opportunities table: {e}")

    def _parse_topic_focused_table(self, response):
        """Parse the Topic-focused Funding Opportunities table."""
        try:
            # Find the table that contains "Topic Focused Research Funding Opportunities"
            table = None
            
            # Approach 1: Look for table with the specific text
            table = response.xpath('//table[.//text()[contains(., "Topic Focused Research Funding Opportunities")]]')
            
            # Approach 2: Look for heading followed by table
            if not table:
                table = response.xpath('//*[contains(text(), "Topic Focused Research Funding Opportunities")]/following-sibling::table[1]')
            
            # Approach 3: Look for table with specific grant names
            if not table:
                table = response.xpath('//table[.//text()[contains(., "Novel Artificial Intelligence") or contains(., "Strategically Focused Research Network")]]')
            
            # Approach 4: Look for table with specific structure
            if not table:
                table = response.xpath('//table[@class="table table-striped"]')
            
            if table:
                self.logger.info(f"Found topic focused table with {len(table)} tables")
                rows = table.xpath('.//tr')  # Get all rows
                self.logger.info(f"Found {len(rows)} rows in topic focused table")
                
                for row in rows:
                    grant_item = self._extract_grant_from_row(row, response, "American Heart Association")
                    if grant_item:
                        yield grant_item
            else:
                self.logger.warning("Could not find Topic Focused Research Funding Opportunities table")
                        
        except Exception as e:
            self.logger.error(f"Error parsing topic focused table: {e}")

    def _parse_data_science_table(self, response):
        """Parse the Data Science Grants table."""
        try:
            # Find the section that contains "Data Science Grants"
            data_science_section = response.xpath('//*[contains(text(), "Data Science Grants")]')
            
            if data_science_section:
                # Check if there's a "No active requests" message
                no_requests = data_science_section.xpath('.//text()[contains(., "No active requests")]')
                if no_requests:
                    self.logger.info("Data Science Grants table found but has no active requests")
                    return
                
                # Look for table in the section
                table = data_science_section.xpath('.//table')
                if table:
                    self.logger.info(f"Found data science table with {len(table)} tables")
                    rows = table.xpath('.//tr')
                    self.logger.info(f"Found {len(rows)} rows in data science table")
                    
                    for row in rows:
                        grant_item = self._extract_grant_from_row(row, response, "American Heart Association")
                        if grant_item:
                            yield grant_item
                else:
                    self.logger.info("Data Science Grants section found but no table with active grants")
            else:
                self.logger.warning("Could not find Data Science Grants section")
                        
        except Exception as e:
            self.logger.error(f"Error parsing data science table: {e}")

    def _parse_registry_research_table(self, response):
        """Parse the AHA Registry Research table."""
        try:
            # Find the section that contains "AHA Registry Research"
            registry_section = response.xpath('//*[contains(text(), "AHA Registry Research")]')
            
            if registry_section:
                # Look for links in the section
                links = registry_section.xpath('.//a')
                if links:
                    self.logger.info(f"Found {len(links)} links in AHA Registry Research section")
                    
                    for link in links:
                        title = link.xpath('.//text()').get()
                        href = link.xpath('@href').get()
                        
                        if title and href:
                            # Clean the title
                            title = re.sub(r'<[^>]+>', '', title)
                            title = re.sub(r'\s+', ' ', title).strip()
                            
                            # Skip if title is too short
                            if len(title) < 5:
                                continue
                            
                            # Check for duplicates
                            if title in self.seen_titles:
                                continue
                            
                            grant_item = GrantscraperItem()
                            grant_item["title"] = title
                            grant_item["type"] = "Private"
                            grant_item["agency"] = "American Heart Association"
                            grant_item["url"] = response.urljoin(href)
                            
                            self.seen_titles.add(title)
                            yield grant_item
                else:
                    # Try to find the link in the entire section
                    all_links = registry_section.xpath('.//a')
                    if all_links:
                        self.logger.info(f"Found {len(all_links)} links in AHA Registry Research section")
                        
                        for link in all_links:
                            title = link.xpath('.//text()').get()
                            href = link.xpath('@href').get()
                            
                            if title and href:
                                # Clean the title
                                title = re.sub(r'<[^>]+>', '', title)
                                title = re.sub(r'\s+', ' ', title).strip()
                                
                                # Skip if title is too short
                                if len(title) < 5:
                                    continue
                                
                                # Check for duplicates
                                if title in self.seen_titles:
                                    continue
                                
                                grant_item = GrantscraperItem()
                                grant_item["title"] = title
                                grant_item["type"] = "Private"
                                grant_item["agency"] = "American Heart Association"
                                grant_item["url"] = response.urljoin(href)
                                
                                self.seen_titles.add(title)
                                yield grant_item
                    else:
                        # Try to find any link with "National Level Program Data Research Opportunities"
                        registry_links = response.xpath('//a[contains(@href, "national-level-program-data-research-opportunities") or contains(text(), "National Level Program Data Research Opportunities")]')
                        if registry_links:
                            self.logger.info(f"Found {len(registry_links)} registry research links")
                            
                            for link in registry_links:
                                title = link.xpath('.//text()').get()
                                href = link.xpath('@href').get()
                                
                                if title and href:
                                    # Clean the title
                                    title = re.sub(r'<[^>]+>', '', title)
                                    title = re.sub(r'\s+', ' ', title).strip()
                                    
                                    # Skip if title is too short
                                    if len(title) < 5:
                                        continue
                                    
                                    # Check for duplicates
                                    if title in self.seen_titles:
                                        continue
                                    
                                    grant_item = GrantscraperItem()
                                    grant_item["title"] = title
                                    grant_item["type"] = "Private"
                                    grant_item["agency"] = "American Heart Association"
                                    grant_item["url"] = response.urljoin(href)
                                    
                                    self.seen_titles.add(title)
                                    yield grant_item
                        else:
                            self.logger.info("AHA Registry Research section found but no links")
            else:
                self.logger.warning("Could not find AHA Registry Research section")
                
        except Exception as e:
            self.logger.error(f"Error parsing registry research table: {e}")

    def _extract_grant_from_row(self, row, response, default_agency):
        """Extract grant information from a table row."""
        try:
            cells = row.xpath('.//td | .//th')
            if not cells:
                return None
            
            # Skip header rows
            row_text = row.xpath('.//text()').getall()
            row_text = ' '.join([text.strip() for text in row_text if text.strip()])
            
            # Skip if this looks like a header row
            header_keywords = ['grant', 'award', 'fellowship', 'funding', 'deadline', 'description']
            if any(keyword in row_text.lower() for keyword in header_keywords) and len(row_text) < 50:
                return None
            
            grant_item = GrantscraperItem()
            grant_item["type"] = "Private"
            grant_item["agency"] = default_agency
            
            first_cell = cells[0]
            cell_text = first_cell.xpath('.//text()').getall()
            cell_text = ' '.join([text.strip() for text in cell_text if text.strip()])
            
            if not cell_text:
                return None
            
            lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
            if not lines:
                return None
            
            title = None
            title_link = first_cell.xpath('.//a/@href').get()
            bold_text = first_cell.xpath('.//strong/text()').get()
            
            if title_link:
                title_text = first_cell.xpath('.//a/text()').get()
                if title_text and bold_text:
                    # If we have both link text and bold text, prioritize bold text (it's usually the correct title)
                    title = bold_text.strip()
                    grant_item["url"] = response.urljoin(title_link)
                elif title_text:
                    title = title_text.strip()
                    grant_item["url"] = response.urljoin(title_link)
                else:
                    # If no link text, try to get the first line that's not a date/description
                    title = lines[0]
                    grant_item["url"] = response.urljoin(title_link)
            else:
                if bold_text:
                    title = bold_text.strip()
                else:
                    # Use the first line as title, but clean it up
                    title = lines[0]
                grant_item["url"] = response.url
            
            # Clean the title - remove any HTML tags and normalize whitespace
            title = re.sub(r'<[^>]+>', '', title)
            title = re.sub(r'\s+', ' ', title).strip()
            
            # Clean up titles to remove deadline and description information
            # Split on common patterns that indicate the end of the actual grant name
            title_cleanup_patterns = [
                'Proposal deadline:', 'Deadline for', 'This award', 'Stimulates research',
                'Supports highly', 'Enhances the training', 'Required Pre-proposal due:',
                'Novel pilot', 'Jointly funded', 'Within this award', 'Through the'
            ]
            
            for pattern in title_cleanup_patterns:
                if pattern in title:
                    title = title.split(pattern)[0].strip()
                    break
            
            # Additional cleanup for specific grant types
            if 'Institutional Award' in title and 'for Undergraduate Student Training' in title:
                title = 'Institutional Award for Undergraduate Student Training'
            elif 'AIREA' in title and 'Institutional Research Enhancement Award' in title:
                title = 'AHA Institutional Research Enhancement Award (AIREA)'
            
            skip_keywords = [
                'awards & lectures', 'awardee resources', 'see data', 
                'funding opportunities', 'autism speaks', 'proposal deadline:',
                'deadline for', 'novel pilot program', 'jointly funded',
                'aha/chf congenital heart defect research awards', 'california walnut commission',
                'barth syndrome foundation', 'viva physician research award', 'read more',
                'scientific sessions', 'conference', 'meeting', 'symposium',
                'offices will be closed', 'proposal central will be closed', 'jan.', 'feb.', 'mar.', 'apr.', 'may', 'june', 'july', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'
            ]
            
            # Check for exact matches that should be skipped
            exact_skip_titles = [
                'read more', 'learn more', 'view more', 'scientific sessions 2025',
                'scientific sessions', 'read more about', 'learn more about'
            ]
            
            collaboration_partners = [
                'aha/chf congenital heart defect research awards',
                'california walnut commission', 
                'autism speaks',
                'barth syndrome foundation',
                'viva physician research award',
                'american headache society'
            ]
            
            if len(title) < 5 or any(skip in title.lower() for skip in skip_keywords):
                return None
            
            # Check for exact title matches that should be skipped
            if title.lower().strip() in exact_skip_titles:
                return None
            
            if any(partner in title.lower() for partner in collaboration_partners):
                return None
            
            # Additional validation - skip titles that are just dates or very short
            if len(title) < 10 or title.isdigit() or re.match(r'^[A-Za-z]{3}\.\s*\d+$', title):
                return None
            
            # Skip titles that are just month names or dates
            month_names = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december']
            if any(month in title.lower() for month in month_names) and len(title) < 20:
                return None
            
            # Skip very short titles that are likely not grants
            if len(title) < 15 and title.lower() in ['read more', 'learn more', 'view more']:
                return None
            
            if title in self.seen_titles:
                return None
            
            grant_item["title"] = title
            
            # Extract dates from the content - look for text between <br> tags after the title
            # Get the raw HTML of the first cell to extract content between <br> tags
            cell_html = first_cell.get()
            
            if cell_html:
                # Find the title link first
                title_link_match = re.search(r'<a[^>]*>(.*?)</a>', cell_html, re.DOTALL)
                if title_link_match:
                    # Get the position after the closing </a> tag
                    link_end = cell_html.find('</a>', title_link_match.start()) + 4
                    
                    # Look for the next <br> tag after the link
                    next_br_start = cell_html.find('<br', link_end)
                    if next_br_start != -1:
                        # Find the end of this <br> tag
                        br_end = cell_html.find('>', next_br_start) + 1
                        
                        # Look for the next <br> tag after this one
                        next_br_end = cell_html.find('<br', br_end)
                        if next_br_end != -1:
                            # Extract text between the two <br> tags - this should be the date
                            date_text = cell_html[br_end:next_br_end].strip()
                            # Clean the date text
                            date_text = re.sub(r'<[^>]+>', '', date_text)  # Remove any remaining HTML tags
                            date_text = re.sub(r'\s+', ' ', date_text).strip()  # Normalize whitespace
                            
                            if date_text and len(date_text) > 3:
                                grant_item["dates"] = date_text
                        else:
                            # If no second <br>, take everything after the first <br> but stop at any <p> tag
                            remaining_html = cell_html[br_end:]
                            p_start = remaining_html.find('<p')
                            if p_start != -1:
                                date_text = remaining_html[:p_start].strip()
                            else:
                                date_text = remaining_html.strip()
                            
                            date_text = re.sub(r'<[^>]+>', '', date_text)
                            date_text = re.sub(r'\s+', ' ', date_text).strip()
                            
                            if date_text and len(date_text) > 3:
                                grant_item["dates"] = date_text
                else:
                    # No link found, try to find <br> tags after the title text
                    # Look for the title in the HTML and find <br> tags after it
                    title_in_html = re.search(re.escape(title), cell_html, re.IGNORECASE)
                    if title_in_html:
                        title_end = title_in_html.end()
                        # Look for <br> tag after the title
                        br_start = cell_html.find('<br', title_end)
                        if br_start != -1:
                            br_end = cell_html.find('>', br_start) + 1
                            # Look for next <br> tag
                            next_br_end = cell_html.find('<br', br_end)
                            if next_br_end != -1:
                                date_text = cell_html[br_end:next_br_end].strip()
                                date_text = re.sub(r'<[^>]+>', '', date_text)
                                date_text = re.sub(r'\s+', ' ', date_text).strip()
                                
                                if date_text and len(date_text) > 3:
                                    grant_item["dates"] = date_text
                            else:
                                # Take everything after the first <br> but stop at any <p> tag
                                remaining_html = cell_html[br_end:]
                                p_start = remaining_html.find('<p')
                                if p_start != -1:
                                    date_text = remaining_html[:p_start].strip()
                                else:
                                    date_text = remaining_html.strip()
                                
                                date_text = re.sub(r'<[^>]+>', '', date_text)
                                date_text = re.sub(r'\s+', ' ', date_text).strip()
                                
                                if date_text and len(date_text) > 3:
                                    grant_item["dates"] = date_text
                    else:
                        # Try a different approach - look for the title in <strong> tags
                        strong_title_match = re.search(r'<strong>(.*?)</strong>', cell_html, re.DOTALL)
                        if strong_title_match:
                            strong_end = cell_html.find('</strong>', strong_title_match.start()) + 9
                            # Look for <br> tag after the strong tag
                            br_start = cell_html.find('<br', strong_end)
                            if br_start != -1:
                                br_end = cell_html.find('>', br_start) + 1
                                # Look for next <br> tag
                                next_br_end = cell_html.find('<br', br_end)
                                if next_br_end != -1:
                                    date_text = cell_html[br_end:next_br_end].strip()
                                    date_text = re.sub(r'<[^>]+>', '', date_text)
                                    date_text = re.sub(r'\s+', ' ', date_text).strip()
                                    
                                    if date_text and len(date_text) > 3:
                                        grant_item["dates"] = date_text
                                else:
                                    # Take everything after the first <br> but stop at any <p> tag
                                    remaining_html = cell_html[br_end:]
                                    p_start = remaining_html.find('<p')
                                    if p_start != -1:
                                        date_text = remaining_html[:p_start].strip()
                                    else:
                                        date_text = remaining_html.strip()
                                    
                                    date_text = re.sub(r'<[^>]+>', '', date_text)
                                    date_text = re.sub(r'\s+', ' ', date_text).strip()
                                    
                                    if date_text and len(date_text) > 3:
                                        grant_item["dates"] = date_text
                        else:
                            # Try a more flexible approach - look for any <br> tags and extract content
                            # This is specifically for the first 5 grants that have a specific structure
                            if any(grant_name in title for grant_name in ['AHA Predoctoral Fellowship', 'AHA Postdoctoral Fellowship', 'Institutional Award', 'AIREA', 'Career Development Award']):
                                # Look for all <br> tags in the cell
                                br_positions = []
                                pos = 0
                                while True:
                                    pos = cell_html.find('<br', pos)
                                    if pos == -1:
                                        break
                                    br_positions.append(pos)
                                    pos += 1
                                
                                if len(br_positions) >= 2:
                                    # Get the text between the first and second <br> tags
                                    first_br_end = cell_html.find('>', br_positions[0]) + 1
                                    second_br_start = br_positions[1]
                                    
                                    date_text = cell_html[first_br_end:second_br_start].strip()
                                    date_text = re.sub(r'<[^>]+>', '', date_text)
                                    date_text = re.sub(r'\s+', ' ', date_text).strip()
                                    
                                    if date_text and len(date_text) > 3:
                                        grant_item["dates"] = date_text
            
            # Extract description - everything after the dates
            # Remove the title from the beginning of the text
            remaining_text = cell_text
            if title and cell_text.startswith(title):
                remaining_text = cell_text[len(title):].strip()
            
            # Remove date information from the description if we found dates
            if grant_item.get("dates"):
                remaining_text = remaining_text.replace(grant_item["dates"], "")
            
            # Remove collaboration partner information
            collaboration_patterns = [
                r'Within this award, additional collaboration money.*?\.',
                r'Through the.*?\.',
                r'Jointly funded by.*?\.'
            ]
            
            for pattern in collaboration_patterns:
                remaining_text = re.sub(pattern, '', remaining_text, flags=re.IGNORECASE)
            
            # Clean up the description
            remaining_text = re.sub(r'\s+', ' ', remaining_text).strip()
            remaining_text = re.sub(r'^\s*[.,]\s*', '', remaining_text)  # Remove leading punctuation
            
            if remaining_text and len(remaining_text) > 20:
                grant_item["description"] = remaining_text
            
            # If we have multiple cells, try to extract additional info from other cells
            if len(cells) > 1:
                # Second cell might contain dates
                second_cell_text = cells[1].xpath('.//text()').getall()
                second_cell_text = ' '.join([text.strip() for text in second_cell_text if text.strip()])
                if second_cell_text and not grant_item.get("dates"):
                    second_cell_text = re.sub(r'<[^>]+>', '', second_cell_text)
                    grant_item["dates"] = second_cell_text.strip()
                
                # Third cell might contain description
                if len(cells) > 2 and not grant_item.get("description"):
                    third_cell_text = cells[2].xpath('.//text()').getall()
                    third_cell_text = ' '.join([text.strip() for text in third_cell_text if text.strip()])
                    if third_cell_text:
                        third_cell_text = re.sub(r'<[^>]+>', '', third_cell_text)
                        grant_item["description"] = third_cell_text.strip()
            
            # Only return if we have a valid title
            if grant_item["title"] and len(grant_item["title"]) > 5:
                self.seen_titles.add(grant_item["title"])
                return grant_item
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting grant from row: {e}")
            return None

    def _extract_registry_grant_from_row(self, row, response):
        """Extract grant information from AHA Registry Research table row."""
        try:
            # Get all cells in the row
            cells = row.xpath('.//td | .//th')
            
            if not cells:
                return None
            
            grant_item = GrantscraperItem()
            grant_item["type"] = "Private"
            grant_item["agency"] = "American Heart Association"
            
            # Get the text content of the first cell (usually contains title and link)
            first_cell = cells[0]
            
            # Extract clean text from the cell, removing HTML tags
            cell_text = first_cell.xpath('.//text()').getall()
            cell_text = ' '.join([text.strip() for text in cell_text if text.strip()])
            
            if not cell_text:
                return None
            
            # Split into lines and clean them
            lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
            
            if not lines:
                return None
            
            # First line contains title and potentially URL
            title_line = lines[0]
            
            # Clean the title - remove HTML artifacts and extra whitespace
            title_line = re.sub(r'<[^>]+>', '', title_line)  # Remove HTML tags
            title_line = re.sub(r'\s+', ' ', title_line)  # Normalize whitespace
            title_line = title_line.strip()
            
            # Skip if title is too short
            if len(title_line) < 5:
                return None
            
            # Check if title contains a link
            title_link = first_cell.xpath('.//a/@href').get()
            if title_link:
                grant_item["url"] = response.urljoin(title_link)
                # Extract title text from the link
                title_text = first_cell.xpath('.//a/text()').get()
                if title_text:
                    grant_item["title"] = title_text.strip()
                else:
                    grant_item["title"] = title_line
            else:
                grant_item["title"] = title_line
                grant_item["url"] = response.url
            
            # Check for duplicates
            if grant_item["title"] in self.seen_titles:
                return None
            
            # Only return if we have a valid title
            if grant_item["title"] and len(grant_item["title"]) > 5:
                self.seen_titles.add(grant_item["title"])
                return grant_item
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error extracting registry grant from row: {e}")
            return None
    
    def handle_error(self, failure):
        """Handle request errors."""
        self.logger.error(f"Request failed: {failure.value}")
        self.logger.error(f"Request URL: {failure.request.url}")
