import { NextRequest, NextResponse } from "next/server";
import { runQuickSearch } from "../../../eureka/quickSearch";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5, numCandidates = 30 } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    const docs = await runQuickSearch(query, {
      limit: Math.min(Math.max(Number(limit) || 5, 1), 10),
      numCandidates: Math.min(Math.max(Number(numCandidates) || 30, 5), 200),
    });

    const formatted = docs.map((doc, idx) => {
      const authors = doc.authors_string
        ? doc.authors_string.split("|").map((a) => a.trim()).filter(Boolean)
        : [];

      // Extract and format publication_date
      let publicationDate = doc.publication_date;
      let formattedPublicationDate: string | undefined;
      
      if (publicationDate) {
        // Convert to string and trim
        const dateStr = String(publicationDate).trim();
        
        // Check if it's a valid date format
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format
          formattedPublicationDate = dateStr;
        } else if (dateStr.match(/^\d{4}$/)) {
          // Just a year, add month and day
          formattedPublicationDate = `${dateStr}-01-01`;
        } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
          // YYYY-MM format, add day
          formattedPublicationDate = `${dateStr}-01`;
        } else {
          // Try to parse as Date object and reformat
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            const year = parsedDate.getFullYear();
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const day = String(parsedDate.getDate()).padStart(2, '0');
            formattedPublicationDate = `${year}-${month}-${day}`;
          }
        }
      } else if ((doc as any).year) {
        // Fallback to year field
        const yearStr = String((doc as any).year).trim();
        if (yearStr.match(/^\d{4}$/)) {
          formattedPublicationDate = `${yearStr}-01-01`;
        }
      }
      
      // Final validation - ensure the date is valid
      if (formattedPublicationDate) {
        const testDate = new Date(formattedPublicationDate + "T00:00:00");
        if (isNaN(testDate.getTime())) {
          formattedPublicationDate = undefined;
        }
      }

      return {
        rank: idx + 1,
        title: doc.title,
        authors,
        year: formattedPublicationDate || undefined,
        publication_date: formattedPublicationDate,
        journal: doc.journal,
        doi: doc.doi,
        work_id: doc.work_id,
        abstract: doc.abstract,
        cited_by_count: doc.cited_by_count,
        subfields: doc.subfields || [],
        keywords: doc.keywords || [],
        open_access: doc.open_access ?? false,
        score: doc.score,
      };
    });

    return NextResponse.json({
      success: true,
      query,
      results: formatted,
      notes: [
        "Results ranked by semantic similarity to your query.",
        `Showing top ${formatted.length} most relevant papers.`,
      ],
      metadata: {
        limit,
        numCandidates,
        mode: "quick_search",
        resultsCount: formatted.length,
      },
    });
  } catch (error: any) {
    console.error("Eureka Quick Search Full API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process Eureka Quick Search query",
        details: error?.message,
      },
      { status: 500 }
    );
  }
}

