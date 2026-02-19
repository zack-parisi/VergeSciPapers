#!/usr/bin/env python3
"""
Test script for Eureka Chat Mode
Run this to test the chat mode before using the UI
"""
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from chat_mode import ChatMode

def test_chat_mode(query: str):
    """Test the chat mode with a query"""
    print(f"\n{'='*80}")
    print("TESTING EUREKA CHAT MODE")
    print(f"{'='*80}")
    print(f"Query: {query}\n")
    
    try:
        chat_mode = ChatMode()
        result = chat_mode.chat(
            query=query,
            num_candidates=30,
            limit=5,
            verbose=True
        )
        chat_mode.close()
        
        print(f"\n{'='*80}")
        print("RESULT")
        print(f"{'='*80}")
        print(f"\nAnswer:\n{result['answer']}\n")
        print(f"\nPapers Retrieved: {len(result.get('papers', []))}")
        if result.get('papers'):
            print("\nPapers:")
            for i, paper in enumerate(result['papers'][:3], 1):  # Show first 3
                print(f"  {i}. {paper.get('title', 'N/A')[:80]}...")
                print(f"     Authors: {paper.get('authors_string', 'N/A')[:60]}...")
                print(f"     Year: {paper.get('year', 'N/A')}")
        
        print(f"\n{'='*80}")
        print("FULL JSON RESULT")
        print(f"{'='*80}")
        print(json.dumps(result, indent=2, default=str))
        
        return result
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    # Default test query if none provided
    test_query = sys.argv[1] if len(sys.argv) > 1 else "How does sleep affect memory consolidation?"
    
    print(f"\nTesting Eureka Chat Mode")
    print(f"Query: {test_query}\n")
    
    result = test_chat_mode(test_query)
    
    if result:
        print("\nTest completed successfully!")
    else:
        print("\nTest failed!")
        sys.exit(1)

