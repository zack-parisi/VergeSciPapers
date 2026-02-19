# Define here the models for your spider middleware
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/spider-middleware.html

from scrapy import signals

# useful for handling different item types with a single interface
from itemadapter import is_item, ItemAdapter


class GrantScraperSpiderMiddleware:
    # Not all methods need to be defined. If a method is not defined,
    # scrapy acts as if the spider middleware does not modify the
    # passed objects.

    @classmethod
    def from_crawler(cls, crawler):
        # This method is used by Scrapy to create your spiders.
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_spider_input(self, response, spider):
        # Called for each response that goes through the spider
        # middleware and into the spider.

        # Should return None or raise an exception.
        return None

    def process_spider_output(self, response, result, spider):
        # Called with the results returned from the Spider, after
        # it has processed the response.

        # Must return an iterable of Request, or item objects.
        for i in result:
            yield i

    def process_spider_exception(self, response, exception, spider):
        # Called when a spider or process_spider_input() method
        # (from other spider middleware) raises an exception.

        # Should return either None or an iterable of Request or item objects.
        pass

    def process_start_requests(self, start_requests, spider):
        # Called with the start requests of the spider, and works
        # similarly to the process_spider_output() method, except
        # that it doesn't have a response associated.

        # Must return only requests (not items).
        for r in start_requests:
            yield r

    def spider_opened(self, spider):
        spider.logger.info("Spider opened: %s" % spider.name)


class GrantScraperDownloaderMiddleware:
    # Not all methods need to be defined. If a method is not defined,
    # scrapy acts as if the downloader middleware does not modify the
    # passed objects.

    @classmethod
    def from_crawler(cls, crawler):
        # This method is used by Scrapy to create your spiders.
        s = cls()
        crawler.signals.connect(s.spider_opened, signal=signals.spider_opened)
        return s

    def process_request(self, request, spider):
        # Called for each request that goes through the downloader
        # middleware.

        # Must either:
        # - return None: continue processing this request
        # - or return a Response object
        # - or return a Request object
        # - or raise IgnoreRequest: process_exception() methods of
        #   installed downloader middleware will be called
        return None

    def process_response(self, request, response, spider):
        # Called with the response returned from the downloader.

        # Must either;
        # - return a Response object
        # - return a Request object
        # - or raise IgnoreRequest
        return response

    def process_exception(self, request, exception, spider):
        # Called when a download handler or a process_request()
        # (from other downloader middleware) raises an exception.

        # Must either:
        # - return None: continue processing this exception
        # - return a Response object: stops process_exception() chain
        # - return a Request object: stops process_exception() chain
        pass

    def spider_opened(self, spider):
        spider.logger.info("Spider opened: %s" % spider.name)


class McKnightHeadersMiddleware:
    """Custom middleware to handle McKnight Foundation site headers."""
    
    def process_request(self, request, spider):
        if 'mcknight.org' in request.url:
            # Use headers that work with the site
            request.headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                'DNT': '1',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
            })
        return None


class SeleniumMiddleware:
    """Middleware to handle Selenium requests for McKnight Foundation."""
    
    def __init__(self):
        self.driver = None  # Initialize driver lazily
    
    def _get_driver(self):
        """Initialize Chrome driver only when needed."""
        if self.driver is None:
            try:
                from selenium import webdriver
                from selenium.webdriver.chrome.options import Options
                
                # Set up Chrome options for headless browsing
                chrome_options = Options()
                chrome_options.add_argument("--headless")
                chrome_options.add_argument("--no-sandbox")
                chrome_options.add_argument("--disable-dev-shm-usage")
                chrome_options.add_argument("--disable-gpu")
                chrome_options.add_argument("--window-size=1920,1080")
                chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
                
                self.driver = webdriver.Chrome(options=chrome_options)
            except Exception as e:
                # Log the error but don't crash the spider
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to initialize Chrome driver: {e}")
                return None
        return self.driver
    
    def process_request(self, request, spider):
        # Handle both McKnight Foundation and ERC requests
        if (('mcknight.org' in request.url and hasattr(spider, 'name') and spider.name == 'mcknight_foundation') or
            ('ec.europa.eu' in request.url and hasattr(spider, 'name') and spider.name == 'erc')):
            driver = self._get_driver()
            if driver is None:
                spider.logger.error("Chrome driver not available")
                return None
                
            import time
            from scrapy.http import HtmlResponse
            
            try:
                # Use Selenium to get the page
                driver.get(request.url)
                # Wait longer for JavaScript-heavy pages like EU funding portal
                time.sleep(5)  # Wait for page to load
                
                # Create a response object with the page source
                response = HtmlResponse(
                    url=request.url,
                    body=driver.page_source.encode('utf-8'),
                    encoding='utf-8'
                )
                
                return response
            except Exception as e:
                spider.logger.error(f"Selenium error for {request.url}: {e}")
                return None
        
        return None
    
    def process_exception(self, request, exception, spider):
        # Handle exceptions from Selenium
        if ((('mcknight.org' in request.url and hasattr(spider, 'name') and spider.name == 'mcknight_foundation') or
             ('ec.europa.eu' in request.url and hasattr(spider, 'name') and spider.name == 'erc'))):
            spider.logger.error(f"Selenium exception for {request.url}: {exception}")
            return None
        return None
    
    def __del__(self):
        if hasattr(self, 'driver') and self.driver is not None:
            try:
                self.driver.quit()
            except:
                pass  # Ignore errors during cleanup
