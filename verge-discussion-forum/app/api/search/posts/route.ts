import { NextRequest, NextResponse } from 'next/server';
import { getPapersCleanCollection } from '../../../../lib/mongodb-user-interactions';
import { transformMongoDBPaperToStaffPost } from '../../../../lib/mongodb-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const searchType = searchParams.get('searchType') || 'topics';
    const searchQuery = searchParams.get('searchQuery') || '';
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    console.log(' Smart Search API called with:', {
      searchType,
      searchQuery,
      limit
    });

    const papersCleanCollection = await getPapersCleanCollection();

    if (searchType === 'authors' && searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
      let papersPosts: any[] = [];
      
      if (trimmedQuery.includes(' ')) {
        // Multi-word author query - use authors_string for fast search
        console.log(' Multi-word author query detected:', trimmedQuery);
        
        try {
          // Search the concatenated authors_string field
          const query = { authors_string: { $regex: trimmedQuery, $options: 'i' } };
          papersPosts = await papersCleanCollection
            .find(query)
            .limit(limit)
            .maxTimeMS(5000)
            .toArray();
          
          // Sort in memory (faster than DB sort)
          papersPosts.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
          
          console.log(` Multi-word author query found ${papersPosts.length} papers`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(' Multi-word author search failed:', errorMsg);
          papersPosts = [];
        }
      } else {
        // Single word author query - use authors_string for fast search
        console.log(' Single word author query:', trimmedQuery);
        
        try {
          // Search the concatenated authors_string field instead of array
          // Don't sort in DB - sort in memory for better performance
          const query = { authors_string: { $regex: trimmedQuery, $options: 'i' } };
          papersPosts = await papersCleanCollection
            .find(query)
            .limit(limit)
            .maxTimeMS(5000)
            .toArray();
          
          // Sort in memory (faster than DB sort with regex queries)
          papersPosts.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
          
          console.log(` Author query found ${papersPosts.length} papers`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(' Author search failed:', errorMsg);
          papersPosts = [];
        }
      }

      console.log(` Author search result: ${papersPosts.length} papers`);

      // Transform to the expected format
      const transformedPosts = papersPosts.map((paper: any) => transformMongoDBPaperToStaffPost(paper));

      return NextResponse.json({
        success: true,
        posts: transformedPosts,
        totalCount: papersPosts.length
      });
    }

    if (searchType === 'title' && searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
      let papersPosts: any[] = [];
      
      console.log(' Title search query:', trimmedQuery);
      
      try {
        // Optimized title search (string field with hint and filter)
        // Title is a STRING field so hint works efficiently (unlike array fields)
        const query = { 
          title: { $regex: trimmedQuery, $options: 'i' },
          relevance_score: { $gte: 0.1 } // Filter reduces dataset significantly
        };
        papersPosts = await papersCleanCollection
          .find(query)
          .hint({ title: 1 }) // Hint works well for string field searches
          .limit(limit)
          .maxTimeMS(5000)
          .toArray();
        
        // Sort in memory (faster than DB sort with regex queries)
        papersPosts.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
        
        console.log(` Title search found ${papersPosts.length} papers`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(' Title search failed:', errorMsg);
        papersPosts = [];
      }

      // Transform to the expected format
      const transformedPosts = papersPosts.map((paper: any) => transformMongoDBPaperToStaffPost(paper));

      return NextResponse.json({
        success: true,
        posts: transformedPosts,
        totalCount: papersPosts.length
      });
    }

    // For non-author/title searches, return empty for now
    return NextResponse.json({
      success: true,
      posts: [],
      totalCount: 0
    });

  } catch (error) {
    console.error(' Search API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Search failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
