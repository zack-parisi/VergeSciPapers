#!/bin/bash
# Eureka Setup Script
# Quick setup for VergeSci AI Research Assistant

echo "=========================================="
echo "Eureka Setup"
echo "=========================================="
echo ""

# Check Python version
echo "[1/5] Checking Python version..."
python3 --version || {
    echo "Error: Python 3 not found. Please install Python 3.9 or higher."
    exit 1
}
echo "Python 3 found"
echo ""

# Create virtual environment
echo "[2/5] Creating virtual environment..."
if [ -d "venv" ]; then
    echo "Virtual environment already exists. Skipping creation."
else
    python3 -m venv venv
    echo "Virtual environment created"
fi
echo ""

# Activate and install dependencies
echo "[3/5] Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
if ! pip install -r requirements.txt; then
    echo "Standard installation failed. Trying with flexible numpy version..."
    # If installation fails, try installing numpy separately with flexible version
    pip install pymongo==4.10.1 openai==1.12.0 httpx==0.26.0 python-dotenv==1.0.1 click==8.1.7 rich==13.9.4 python-dateutil==2.9.0 "numpy>=1.24.3" || {
        echo "Error: Failed to install dependencies. Please check your Python version (3.9+ required)."
        exit 1
    }
fi
echo "Dependencies installed"
echo ""

# Check environment configuration
echo "[4/5] Checking configuration..."
if [ -f ".env" ]; then
    echo "Found .env file"
elif [ -f "../verge-discussion-forum/.env.local" ]; then
    echo "Found verge-discussion-forum/.env.local"
else
    echo "No .env file found. Make sure OPENAI_API_KEY is set."
    echo "   Creating .env template..."
    cat > .env << 'EOF'
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=verge_neuro_lit_topics
MONGODB_COLLECTION=papers_clean

# OpenAI Configuration
OPENAI_API_KEY=your-api-key-here

# Vector Search Configuration
VECTOR_INDEX_NAME=vector_index
VECTOR_DIMENSIONS=1536
VECTOR_MODEL=text-embedding-3-small
EOF
    echo "   Please edit .env with your credentials"
fi
echo ""

# Run system test
echo "[5/5] Running system test..."
echo ""
python eureka_cli.py test

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Try these commands:"
echo "  python eureka_cli.py examples"
echo "  python eureka_cli.py search \"your neuroscience query\""
echo "  python eureka_cli.py translate \"complex query\""
echo ""
echo "See QUICKSTART.md for more information."
echo ""


