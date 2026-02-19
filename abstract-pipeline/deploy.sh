#!/bin/bash

# Verge Pipeline Cloud Deployment Script
# This script handles deployment with proper error handling and monitoring

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROD_COMPOSE_FILE="docker-compose.prod.yml"
ENVIRONMENT=${1:-"development"}

echo -e "${BLUE}Verge Pipeline Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo "=================================="

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Function to validate configuration
validate_config() {
    log "Validating configuration..."
    
    # Check if config.json exists
    if [ ! -f "config.json" ]; then
        error "config.json not found. Please create it first."
        exit 1
    fi
    
    # Check if required environment variables are set
    if [ -z "$MONGO_URI" ]; then
        warn "MONGO_URI not set. Using default from docker-compose.yml"
    fi
    
    log "Configuration validation passed"
}

# Function to build images
build_images() {
    log "Building Docker images..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f $PROD_COMPOSE_FILE build --no-cache
    else
        docker-compose -f $COMPOSE_FILE build --no-cache
    fi
    
    log "Images built successfully"
}

# Function to start services
start_services() {
    log "Starting services..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f $PROD_COMPOSE_FILE up -d
    else
        docker-compose -f $COMPOSE_FILE up -d
    fi
    
    log "Services started"
}

# Function to wait for services to be healthy
wait_for_health() {
    log "Waiting for services to be healthy..."
    
    # Wait for Redis
    log "Waiting for Redis..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker exec verge_redis redis-cli ping &> /dev/null; then
            log "Redis is healthy"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        error "Redis failed to become healthy"
        exit 1
    fi
    
    # Wait for API
    log "Waiting for API..."
    timeout=120
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:5001/api/health &> /dev/null; then
            log "API is healthy"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        error "API failed to become healthy"
        exit 1
    fi
    
    # Wait for Frontend (if running)
    log "Waiting for Frontend..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:3000 &> /dev/null; then
            log "Frontend is healthy"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [ $timeout -le 0 ]; then
        warn "Frontend may not be fully ready yet"
    fi
}

# Function to run scraper
run_scraper() {
    log "Starting scraper..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f $PROD_COMPOSE_FILE run --rm scraper
    else
        docker-compose -f $COMPOSE_FILE run --rm scraper
    fi
    
    log "Scraper completed"
}

# Function to show status
show_status() {
    log "Service Status:"
    echo "=================="
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f $PROD_COMPOSE_FILE ps
    else
        docker-compose -f $COMPOSE_FILE ps
    fi
    
    echo ""
    log "Health Check Results:"
    echo "===================="
    
    # Check API health
    if curl -s http://localhost:5001/api/health | jq . 2>/dev/null; then
        log "API Health Check"
    else
        error "API Health Check Failed"
    fi
    
    echo ""
    log "Access URLs:"
    echo "============"
    echo "Frontend: http://localhost:3000"
    echo "API: http://localhost:5001"
    echo "API Health: http://localhost:5001/api/health"
    echo "API Stats: http://localhost:5001/api/stats"
}

# Function to cleanup on error
cleanup() {
    error "Deployment failed. Cleaning up..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f $PROD_COMPOSE_FILE down
    else
        docker-compose -f $COMPOSE_FILE down
    fi
    
    exit 1
}

# Set up error handling
trap cleanup ERR

# Main deployment process
main() {
    log "Starting deployment process..."
    
    check_prerequisites
    validate_config
    build_images
    start_services
    wait_for_health
    
    # Ask user if they want to run the scraper
    echo ""
    read -p "Do you want to run the scraper now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_scraper
    else
        log "Skipping scraper. You can run it later with: docker-compose run --rm scraper"
    fi
    
    show_status
    
    log "Deployment completed successfully!"
    log "Your Verge Pipeline is now running in the cloud!"
}

# Run main function
main "$@" 