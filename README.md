# Verge Sciences

A full-stack platform for neuroscience researchers to discover papers, find grants, collaborate, and explore literature using AI-powered search.

The platform scrapes academic papers daily from OpenAlex and grant opportunities from 18+ funding organizations, processes and vectorizes them for semantic search, and serves them through a Next.js web application with an AI research assistant (Eureka).

---

## Repository Structure

### [`verge-discussion-forum/`](./verge-discussion-forum)

The main web application — a Next.js 15 (React 19) full-stack app deployed on Vercel.

**What it does:**
- Personalized paper feed with topic-based filtering and relevance scoring
- Forum with posts, comments, reposts, and staff announcements
- Grant discovery with bookmarking and search
- Eureka AI assistant — chat, search, translate, and "update me" modes powered by OpenAI and MongoDB vector search
- User authentication (NextAuth with MongoDB), profiles, networking, and saved content management
- Search across papers, posts, grants, and reposts with journal and subfield filtering

**Key technologies:** Next.js, React, TypeScript, Python, MongoDB, Tailwind CSS, NextAuth, OpenAI API, Vercel, PostHog analytics

**Notable patterns:**
- `app/api/` — RESTful API routes organized by resource (papers, grants, comments, bookmarks, etc.)
- `app/eureka/` — AI assistant frontend with multiple interaction modes
- `home_feed_page/` — Virtualized infinite-scroll feed with smart post loading
- `lib/` — Database helpers, paper algorithms, and topic mapping utilities
- `scripts/` — Database setup, seeding, and pre-deploy checks

---

### [`abstract-pipeline/`](./abstract-pipeline)

The data ingestion and processing backend — scrapes academic papers from OpenAlex, processes them through a staging-to-clean pipeline, and serves them via a Flask API.

**What it does:**
- Scrapy-based spider that pulls neuroscience papers from the OpenAlex API
- Multi-stage data pipeline: raw ingestion → staging → cleaning/deduplication → production collection
- Flask REST API with Redis caching, rate limiting, and concurrent request handling
- Content recommendation engine using TF-IDF and cosine similarity
- Relevance scoring based on citation counts, recency, and topic alignment
- MongoDB index management for query performance

**Key technologies:** Python, Scrapy, Flask, Gunicorn, MongoDB, Redis, Docker, Docker Compose, Nginx, Prometheus

**Docker (originally built for containerized deployment, later transitioned to Vercel for the frontend):**
- `docker-compose.yml` — Orchestrates 4 services: Flask API, Scrapy scraper, Redis cache, and Nginx load balancer
- `verge_api/Dockerfile` — Production API container with Gunicorn, health checks, non-root user, and memory limits
- `Dockerfile` — Scraper container for one-off data ingestion jobs
- `nginx.conf` — Reverse proxy with rate limiting, gzip compression, CORS, and WebSocket support
- `monitoring/prometheus.yml` — Metrics collection across all services
- `deploy.sh` — Deployment automation with prerequisite checks, health monitoring, and error handling

**Subdirectories:**
- `openalex_scraper/` — Scrapy project for the free-tier OpenAlex API
- `premium-openalex/` — Premium API integration with multiple ingestion flows (from_created, from_updated, general) and a staging-to-clean processor
- `verge_api/` — Flask API serving paper data with caching and content recommendations

---

### [`Eureka/`](./Eureka)

The AI research assistant backend — a Python service that powers the Eureka feature in the web app.

**What it does:**
- Semantic search over vectorized papers using MongoDB Atlas vector search and OpenAI embeddings
- Multi-mode interactions: search (find papers), chat (discuss topics), translate (simplify jargon), and "update me" (recent developments in a field)
- Query preprocessing with filter extraction (date ranges, topics, authors)
- Structured prompt engineering for each interaction mode

**Key technologies:** Python, OpenAI API (embeddings + GPT), MongoDB Atlas Vector Search, prompt engineering

**Architecture:**
- `search_mode.py` / `quick_search_mode.py` — Vector similarity search with configurable candidates and limits
- `chat_mode.py` — Conversational RAG (retrieval-augmented generation) over paper corpus
- `translate_mode.py` — Scientific jargon simplification
- `update_me_mode.py` — Summarizes recent research in a given area
- `embeddings.py` — OpenAI embedding generation and vector search queries
- `filter_parser.py` / `preprocessor.py` — Query parsing and normalization
- `config.py` — Centralized environment and model configuration

---

### [`vectorization-scripts/`](./vectorization-scripts)

Batch processing scripts that generate OpenAI embeddings for the paper corpus, enabling semantic search in Eureka.

**What it does:**
- Vectorizes paper titles and abstracts using OpenAI's `text-embedding-3-small` model
- Batch processing with checkpointing for large-scale runs
- Progress monitoring, cost estimation, and quality verification
- Identifies and processes unvectorized papers incrementally

**Key technologies:** Python, OpenAI Embeddings API, MongoDB, batch processing

**Scripts:**
- `vectorize_papers.py` — Standard vectorization pipeline
- `vectorize_papers_fast.py` — Optimized batch variant for high throughput
- `vectorize_specific_papers.py` — Targeted vectorization by paper ID
- `check_progress.py` / `watch_progress.py` — Progress tracking and live monitoring
- `verify_vector_quality.py` — Quality checks and semantic search validation
- `calculate_cost.py` — Embedding cost estimation

---

### [`grant-pipeline/`](./grant-pipeline)

A Scrapy-based web scraping system that collects grant and fellowship opportunities from 18+ neuroscience funding organizations.

**What it does:**
- Individual spiders for each funding source (NIH, HHMI, Simons Foundation, Wellcome Trust, Chan Zuckerberg Initiative, etc.)
- Extracts grant details: title, description, deadline, funding amount, eligibility, and application URL
- Stores structured grant data in MongoDB for the web app's grant discovery feature

**Key technologies:** Python, Scrapy, MongoDB

**Spiders include:** ALS Association, Alzheimer's Association, American Heart Association, Brain Research Foundation, Burroughs Wellcome, Chan Zuckerberg Initiative, Dana Foundation, Epilepsy Foundation, ERC, Grants.gov, HHMI, Kavli Foundation, McKnight Foundation, Parkinson's Foundation, Pew Trusts, Simons Foundation, Sloan Foundation, Wellcome Trust

---

## How It All Connects

```
OpenAlex API ──→ abstract-pipeline (scrape + process) ──→ MongoDB (papers_clean)
                                                              │
Funding Sites ──→ grant-pipeline (scrape) ──→ MongoDB (grants)│
                                                              │
                  vectorization-scripts ──→ MongoDB (embeddings)
                                                              │
                  Eureka (AI search backend) ←────────────────┘
                       │
                       ▼
                  verge-discussion-forum (Next.js) ──→ Vercel (production)
```

Papers are scraped and processed by `abstract-pipeline`, vectorized by `vectorization-scripts`, and served to users through `verge-discussion-forum`. The `Eureka` backend provides AI-powered search over the vectorized corpus. Grants are independently scraped by `grant-pipeline` and displayed in the web app.

