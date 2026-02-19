import scrapy

class OpenalexScraperItem(scrapy.Item):
    # Core Metadata (Essential for Verge)
    title = scrapy.Field()
    abstract = scrapy.Field()
    doi = scrapy.Field()
    authors = scrapy.Field()
    institutions = scrapy.Field()
    publication_date = scrapy.Field()
    journal = scrapy.Field()
    
    # Access Control
    open_access = scrapy.Field()
    
    # Scoring and Quality Metrics (Essential for recommendations)
    subfields = scrapy.Field()
    cited_by_count = scrapy.Field()
    relevance_score = scrapy.Field()
    abstract_quality_score = scrapy.Field()
    
    # Core Identifiers
    source_id = scrapy.Field()
    work_id = scrapy.Field()
    
    # Metadata for Enhanced Scoring
    concepts_count = scrapy.Field()
    referenced_works_count = scrapy.Field()
    
    # Content Analysis Fields (Used in content recommender)
    keywords = scrapy.Field()
    mesh_terms = scrapy.Field()
    
    # Internal Fields
    created_at = scrapy.Field()
    
    # Neuroscience-specific fields
    matching_topics = scrapy.Field()
    topic_relevance_score = scrapy.Field()
    concept_source = scrapy.Field()
    
    # CEO Topics specific fields
    ceo_topic_id = scrapy.Field()
    ceo_topic_name = scrapy.Field()
    scraped_at = scrapy.Field()
