import { NextRequest, NextResponse } from "next/server";
import { 
  fetchPapersFromMongoDB, 
  fetchPapersByIds,
  getAvailableSubfields,
  getAvailableYears 
} from "../../../../lib/mongodb-helpers";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  console.log(' Papers API called with params:', {
    limit: parseInt(searchParams.get("limit") || "20"),
    page: parseInt(searchParams.get("page") || "1"),
    minRelevance: parseFloat(searchParams.get("minRelevance") || "0.0"),
    subfieldsParam: searchParams.get("subfield"),
    subfields: []
  });
  
  try {
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    
    // Filter parameters
    const minRelevance = parseFloat(searchParams.get("minRelevance") || "0.0");
    const minCitations = parseInt(searchParams.get("minCitations") || "0");
    const year = searchParams.get("year");
    const subfield = searchParams.get("subfield");
    const searchQuery = searchParams.get("search");
    const algorithm = (searchParams.get("algorithm") as 'seminal' | 'relevance') || 'relevance';
    
    // Use helper function to fetch papers with aggressive timeout
    let result;
    try {
      result = await Promise.race([
        fetchPapersFromMongoDB({
          page,
          limit,
          minRelevance,
          minCitations,
          year: year || undefined,
          subfield: subfield || undefined,
          searchQuery: searchQuery || undefined,
          algorithm,
          useClean: true // Use papers_clean collection
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 15000)
        )
      ]) as any;
    } catch (error) {
      console.log(' MongoDB papers query failed, returning empty result:', error instanceof Error ? error.message : 'Unknown error');
      // Return empty result instead of failing
      result = {
        papers: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        },
        filters: {
          minRelevance,
          minCitations,
          year,
          subfield,
          searchQuery,
          algorithm
        }
      };
    }

    return NextResponse.json({
      success: true,
      papers: result.papers || [],
      pagination: result.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0
      },
      filters: result.filters || {
        minRelevance,
        minCitations,
        year,
        subfield,
        searchQuery,
        algorithm
      },
      source: "papers_clean" // Indicate we're using the clean collection
    });
    
  } catch (error) {
    console.error("Error in papers API:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch papers from papers_clean", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { paperIds } = await request.json();
    
    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json({ error: "paperIds array is required" }, { status: 400 });
    }
    
    // Use helper function to fetch papers by IDs
    const papers = await fetchPapersByIds(paperIds);
    
    return NextResponse.json({
      success: true,
      papers: papers,
      count: papers.length
    });
    
  } catch (error) {
    console.error("Error fetching papers by IDs from MongoDB:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch papers by IDs", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 