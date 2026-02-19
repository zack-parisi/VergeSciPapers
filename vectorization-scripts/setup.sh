#!/bin/bash

# Setup script for vectorization environment

echo "=========================================="
echo "Vectorization Scripts Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo ".env file already exists"
else
    echo "Creating .env file from template..."
    cp .env.example .env
    
    echo "Created .env file - add your OPENAI_API_KEY to it"
fi

echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "Virtual environment already exists"
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Created virtual environment"
fi

echo ""

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "Then you can run:"
echo "  python test_single_paper.py      # Test on one paper"
echo "  python check_progress.py         # Check progress"
echo "  python vectorize_papers.py       # Run full vectorization"
echo ""

