import { NextRequest, NextResponse } from "next/server";
import { getPapersStagingCollection, getPapersCleanCollection } from "../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");
    const algorithm = (searchParams.get("algorithm") || "relevance") as 'seminal' | 'relevance';
    
    // Use papers_clean collection for real data
    const collection = await getPapersCleanCollection();

    // Build query, projection, sort, and hint based on algorithm
    const projection = {
      _id: 1,
      title: 1,
      authors: 1,
      publication_date: 1,
      cited_by_count: 1,
      relevance_score: 1,
      journal: 1,
      subfields: 1,
      abstract: 1,
      description: 1,
      doi: 1
    } as const;

    let query: any = { publication_date: { $ne: null, $exists: true } };
    let sort: any;
    let hint: any | undefined;

    if (algorithm === 'seminal') {
      query.cited_by_count = { $gte: 1 };
      sort = { cited_by_count: -1, relevance_score: -1, publication_date: -1 };
      hint = { cited_by_count: -1 };
    } else {
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
      query.$and = [
        {
          publication_date: {
            $type: 'string',
            $gte: '2021-01-01',
            $lte: currentDateStr
          }
        }
      ];
      sort = { publication_date: -1 };
      hint = { publication_date: 1 };
    }
    
    let cursor = collection.find(query, { projection })
      .sort(sort)
      .limit(limit)
      .maxTimeMS(5000);

    if (hint) {
      cursor = cursor.hint(hint);
    }

    const papers = await cursor.toArray();
    
    // Transform to simple format
    const simplePapers = papers.map((paper: any) => ({
      id: paper._id,
      title: paper.title || "",
      authors: paper.authors || [],
      publicationDate: paper.publication_date || "",
      citedByCount: paper.cited_by_count || 0,
      relevanceScore: paper.relevance_score || 0,
      journal: paper.journal || "",
      subfields: paper.subfields || [],
      abstract: paper.abstract || paper.description || "No abstract available.",
      doi: paper.doi || ""
    }));
    
    return NextResponse.json({
      success: true,
      papers: simplePapers,
      count: simplePapers.length,
      message: `Simple ${algorithm} algorithm query completed from papers_clean`,
      source: "papers_clean",
      algorithm
    });
    
  } catch (error) {
    console.error("Error in simple papers query:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch papers from papers_clean", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 