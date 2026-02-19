import scrapy


class GrantscraperItem(scrapy.Item):
    """Item for storing grant information scraped from various funding agencies."""
    
    title = scrapy.Field()
    agency = scrapy.Field()
    type = scrapy.Field()
    description = scrapy.Field()
    eligibility = scrapy.Field()
    amount = scrapy.Field()
    opportunityNumber = scrapy.Field()
    dates = scrapy.Field()
    url = scrapy.Field()
