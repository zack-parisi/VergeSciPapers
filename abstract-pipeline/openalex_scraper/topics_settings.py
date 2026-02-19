# Scrapy settings for topics spider
# This file contains settings specific to the neuroscience topics spider

BOT_NAME = "openalex_scraper"

SPIDER_MODULES = ["openalex_scraper.spiders"]
NEWSPIDER_MODULE = "openalex_scraper.spiders"

# Obey robots.txt rules
ROBOTSTXT_OBEY = True

# Configure maximum concurrent requests performed by Scrapy (default: 16)
CONCURRENT_REQUESTS = 2

# Configure a delay for requests for the same website (default: 0)
DOWNLOAD_DELAY = 0.05  # 50ms between requests (20 req/sec)

# The download delay setting will honor only one of:
CONCURRENT_REQUESTS_PER_DOMAIN = 2
CONCURRENT_REQUESTS_PER_IP = 2

# Disable cookies (enabled by default)
COOKIES_ENABLED = False

# Disable Telnet Console (enabled by default)
TELNETCONSOLE_ENABLED = False

# Override the default request headers:
DEFAULT_REQUEST_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "verge-topics-pipeline/1.0",
}

# Enable or disable spider middlewares
SPIDER_MIDDLEWARES = {
    "openalex_scraper.middlewares.OpenalexScraperSpiderMiddleware": 543,
}

# Enable or disable downloader middlewares
DOWNLOADER_MIDDLEWARES = {
    "openalex_scraper.middlewares.OpenalexScraperDownloaderMiddleware": 543,
}

# Configure item pipelines
# Use the topics-specific pipeline
ITEM_PIPELINES = {
   "openalex_scraper.topics_pipeline.TopicsMongoPipeline": 1,
}

# Enable and configure the AutoThrottle extension
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 0.1
AUTOTHROTTLE_MAX_DELAY = 1.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_DEBUG = False

# Enable and configure HTTP caching
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600  # Cache for 1 hour
HTTPCACHE_DIR = "httpcache"
HTTPCACHE_IGNORE_HTTP_CODES = [429, 500, 502, 503, 504]
HTTPCACHE_STORAGE = "scrapy.extensions.httpcache.FilesystemCacheStorage"

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"

# Retry settings
RETRY_TIMES = 5
RETRY_HTTP_CODES = [429, 500, 502, 503, 504]
DOWNLOAD_TIMEOUT = 60

# Randomize download delay
RANDOMIZE_DOWNLOAD_DELAY = True 