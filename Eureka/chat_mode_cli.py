#!/usr/bin/env python3
"""
Eureka Chat Mode CLI
Standalone script for fast chat mode
Called by API endpoint
"""
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from chat_mode import ChatMode

def main():
    """Main entry point for chat mode CLI"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Query is required"
        }))
        sys.exit(1)
    
    query = sys.argv[1]
    
    try:
        chat_mode = ChatMode()
        result = chat_mode.chat(
            query=query,
            verbose=False
        )
        chat_mode.close()
        
        # Output JSON result
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

