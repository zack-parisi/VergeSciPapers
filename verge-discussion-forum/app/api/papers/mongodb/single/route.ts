import { NextRequest, NextResponse } from "next/server";
import { getPapersStagingCollection } from "../../../../../lib/mongodb-user-interactions.js";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("targetId");
    
    if (!targetId) {
      return NextResponse.json({ error: "targetId parameter is required" }, { status: 400 });
    }

    console.log(" Fetching single MongoDB paper with targetId:", targetId);
    
    const collection = await getPapersStagingCollection();
    
    // Try to find the paper by different possible ID formats
    let paper = null;
    
    // First try exact match with targetId
    paper = await collection.findOne({ _id: targetId });
    
    // If not found, try with openalex: prefix
    if (!paper && !targetId.startsWith("openalex:")) {
      paper = await collection.findOne({ _id: `openalex:${targetId}` });
    }
    
    // If still not found, try extracting the work ID from OpenAlex URL
    if (!paper && targetId.includes("openalex.org/")) {
      const workId = targetId.split("openalex.org/")[1];
      if (workId) {
        paper = await collection.findOne({ _id: `openalex:https://openalex.org/${workId}` });
      }
    }
    
    // If still not found, try searching by the work ID directly
    if (!paper && targetId.includes("openalex.org/")) {
      const workId = targetId.split("openalex.org/")[1];
      if (workId) {
        paper = await collection.findOne({ _id: workId });
      }
    }

    if (!paper) {
      console.log(" No MongoDB paper found for targetId:", targetId);
      return NextResponse.json({ papers: [] });
    }

    console.log(" Found MongoDB paper:", paper.title || paper.display_name);

    // Transform the paper to match StaffPost format
    const transformedPaper = {
      ...paper,
      id: paper._id || paper.id,
      userId: "verge-staff",
      createdAt: paper.createdAt || new Date().toISOString(),
      citation: paper.citation || "",
      relevanceScore: paper.relevance_score || 0,
      authors: paper.authors || [],
      subfields: paper.subfields || [],
      citedByCount: paper.cited_by_count || 0,
      publicationDate: paper.publication_date || new Date().toISOString(),
      doi: paper.doi || "",
      linkId: paper._id || paper.id,
    };

    return NextResponse.json({ papers: [transformedPaper] });
    
  } catch (error) {
    console.error(" Error fetching single MongoDB paper:", error);
    return NextResponse.json({ error: "Failed to fetch paper" }, { status: 500 });
  }
} 