#!/usr/bin/env python3
"""
Script to check robots.txt files for web scraping spiders.
Helps ensure legal compliance before running the spiders.
"""

import requests
import re
from urllib.parse import urljoin


def check_robots_txt(base_url):
    """Check if scraping is allowed by robots.txt."""
    try:
        robots_url = urljoin(base_url, '/robots.txt')
        response = requests.get(robots_url, timeout=10)
        response.raise_for_status()
        
        robots_content = response.text
        print(f"\n=== Robots.txt for {base_url} ===")
        print(robots_content)
        
        # Check for disallow rules
        disallow_pattern = r'Disallow:\s*(.+)'
        disallow_rules = re.findall(disallow_pattern, robots_content, re.IGNORECASE)
        
        if disallow_rules:
            print(f"\nDISALLOW RULES FOUND:")
            for rule in disallow_rules:
                print(f"   - {rule.strip()}")
            
            # Check if target paths are disallowed
            target_paths = ['/grants', '/funding', '/research', '/opportunities']
            for path in target_paths:
                for rule in disallow_rules:
                    if path in rule or rule.strip() == '/':
                        print(f"   Path '{path}' is disallowed!")
                        return False
        
        print(f"\nNo blocking rules found for grant-related paths")
        return True
        
    except requests.RequestException as e:
        print(f"Error checking robots.txt for {base_url}: {e}")
        return False


def main():
    """Check robots.txt for all web scraping spiders."""
    
    spiders = {
        "Alzheimer's Association": "https://www.alz.org",
        "Brain Research Foundation": "https://www.thebrf.org", 
        "Wellcome Trust": "https://wellcome.org",
        "European Research Council": "https://erc.europa.eu",
        "Simons Foundation": "https://www.simonsfoundation.org",
        "McKnight Foundation": "https://www.mcknight.org",
        "Dana Foundation": "https://dana.org",
        "Epilepsy Foundation": "https://www.epilepsy.com",
        "Parkinson's Foundation": "https://www.parkinson.org",
        "ALS Association": "https://www.als.org",
        "Howard Hughes Medical Institute": "https://www.hhmi.org",
        "Pew Charitable Trusts": "https://www.pewtrusts.org",
        "Burroughs Wellcome Fund": "https://www.bwfund.org",
        "Kavli Foundation": "https://kavlifoundation.org",
        "Chan Zuckerberg Initiative": "https://chanzuckerberg.com",
        "Alfred P. Sloan Foundation": "https://sloan.org",
        "American Heart Association": "https://professional.heart.org"
    }
    
    print("Checking robots.txt for web scraping spiders...")
    print("=" * 60)
    
    results = {}
    
    for spider_name, base_url in spiders.items():
        print(f"\nChecking {spider_name}...")
        is_allowed = check_robots_txt(base_url)
        results[spider_name] = is_allowed
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    for spider_name, is_allowed in results.items():
        status = "ALLOWED" if is_allowed else "BLOCKED"
        print(f"{spider_name}: {status}")
    
    print("\nRECOMMENDATIONS:")
    print("- API-based spiders (grantsgov) are always safe to use")
    print("- For web scraping spiders, check the results above")
    print("- If blocked, consider:")
    print("  * Using the organization's API if available")
    print("  * Contacting the organization for data access")
    print("  * Using alternative data sources")
    print("  * Implementing proper delays and respecting rate limits")


if __name__ == "__main__":
    main() 