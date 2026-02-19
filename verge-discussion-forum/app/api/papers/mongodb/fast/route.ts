

import { NextRequest, NextResponse } from "next/server";
import { getPapersStagingCollection, getPapersCleanCollection, getLikesCollection, getCommentsCollection, getBookmarksCollection, getRepostsCollection } from "../../../../../lib/mongodb-user-interactions.js";
import { transformMongoDBPaperToStaffPost } from "../../../../../lib/mongodb-helpers";
import { createRelevanceDateFilterClause } from "../../../../../lib/mongodb-helpers";
import { mapTopicsToSubfields } from "../../../../../lib/topic-mapping";

// Fixed import paths for Vercel deployment compatibility// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/*
RECOMMENDED INDEXES FOR OPTIMAL PERFORMANCE:

1. Subfields + Sort Fields (for subfield-filtered queries):
   db.papers_staging.createIndex({ 
     "subfields": 1, 
     "relevance_score": -1, 
     "cited_by_count": -1, 
     "publication_date": -1 
   })

2. Citation Count + Sort Fields (for citation filtering):
   db.papers_staging.createIndex({ 
     "cited_by_count": -1, 
     "relevance_score": -1, 
     "publication_date": -1 
   })

3. Publication Date + Sort Fields (for date filtering):
   db.papers_staging.createIndex({ 
     "publication_date": 1, 
     "relevance_score": -1, 
     "cited_by_count": -1 
   })

4. Compound filter index (for complex filtering):
   db.papers_staging.createIndex({ 
     "subfields": 1,
     "cited_by_count": -1,
     "publication_date": 1,
     "relevance_score": -1
   })

5. Relevance-only sorting (fallback):
   db.papers_staging.createIndex({ 
     "relevance_score": -1, 
     "cited_by_count": -1, 
     "publication_date": -1 
   })

These indexes support efficient batched queries and filtering
across the 3.7M paper dataset with fast response times.
*/

interface BatchRequest {
  page?: number;
  limit?: number;
  algorithm?: 'seminal' | 'relevance';
  tier?: number;
  lastPaperId?: string;
  userInterests?: string[];
  enableTiered?: boolean;
}

interface BatchResponse {
  papers: any[];
  nextCursor?: string;
  hasMore: boolean;
  tier: number;
  totalProcessed: number;
  algorithm: string;
}

// Helper function to build unified date filter that handles both string and numeric formats
function buildDateFilter(year?: string, yearRangeStart?: number, yearRangeEnd?: number) {
  if (year) {
    // Specific year - handle both "YYYY" string and YYYY number formats
    return {
      $or: [
        { publication_date: { $regex: `^${year}`, $options: 'i' } }, // String format like "2023-01-15"
        { publication_date: parseInt(year) } // Numeric format like 2023
      ]
    };
  } else if (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number') {
    // Simplified year range filter - focus on string dates (most common format)
    // This avoids complex $or operations that cause timeouts
    const startDateStr = `${yearRangeStart}-01-01`;
    const endDateStr = `${yearRangeEnd}-12-31`;
    
    return {
      publication_date: {
        $type: "string",
        $gte: startDateStr,
        $lte: endDateStr
      }
    };
  }
  return null;
}

// Smart batched paper fetching with progressive filtering
async function getBatchedPapers(
  collection: any,
  algorithm: string,
  page: number,
  limit: number,
  subfields: string[] = [],
  journals: string[] = [],
  minCitations?: number,
  year?: string,
  yearRangeStart?: number,
  yearRangeEnd?: number
) {
  console.log(' Building smart batched query with filters:', {
    algorithm,
    page,
    limit,
    subfields: subfields.length,
    journals: journals.length,
    minCitations,
    year,
    yearRangeStart,
    yearRangeEnd
  });

  const skip = (page - 1) * limit;

  // Build the query incrementally for optimal index usage
  const query: any = {
    $and: [
      { publication_date: { $ne: null, $exists: true } },
      { publication_date: { $ne: "2025-12-01" } },
      { relevance_score: { $gte: 0.05 }, } // Basic quality filter
    ]
  };

  // Add algorithm-specific filtering
  if (algorithm === 'seminal') {
    // For seminal algorithm, only get papers with citations to ensure meaningful weighted scoring
    query.cited_by_count = { $gte: 1 };
    console.log(' Applied seminal algorithm filter: papers with citations >= 1');
  }

  // Add subfield filtering (most selective first for index efficiency)
  if (subfields.length > 0) {
    query.subfields = { $in: subfields };
  }

  // Add journal filtering
  if (journals.length > 0) {
    query.journal = { $in: journals };
  }

  // Add relevance algorithm date filter (2021+) only if user hasn't specified their own date filters
  const currentYear = new Date().getFullYear();
  const hasCustomYearRange = typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number' && 
                             !(yearRangeStart === 1990 && yearRangeEnd === currentYear);
  const hasUserDateFilter = year || hasCustomYearRange;
  
  if (algorithm === 'relevance' && !hasUserDateFilter) {
    const relevanceClause = createRelevanceDateFilterClause();
    if (relevanceClause.$or) {
      query.$and.push(relevanceClause);
      console.log(' Applied relevance algorithm date filter (2021+)');
    }
  } else if (hasUserDateFilter) {
    console.log(' Skipping relevance algorithm date filter - user specified custom date filter');
  }

  // Add citation count filter
  if (typeof minCitations === 'number' && minCitations > 0) {
    console.log(' Applying citation filter:', { minCitations });
    query.cited_by_count = { $gte: minCitations };
  } else {
    console.log(' No citation filter applied:', { minCitations });
  }

  // Add date filters (specific year or range)
  const dateFilter = buildDateFilter(year, yearRangeStart, yearRangeEnd);
  console.log(' Date filter result:', { year, yearRangeStart, yearRangeEnd, dateFilter: dateFilter ? 'Applied' : 'Skipped' });
  if (dateFilter) {
    query.$and.push(dateFilter);
  }

  // Define sort order based on algorithm
  let sortOrder: any;
  if (algorithm === 'relevance') {
    sortOrder = {
      relevance_score: -1,
      cited_by_count: -1,
      publication_date: -1
    };
  } else {
    sortOrder = {
      cited_by_count: -1,
      relevance_score: -1,
      publication_date: -1
    };
  }

  console.log(' Executing smart batched query:', JSON.stringify(query, null, 2));
  
  // Debug: Log if seminal algorithm query structure
  if (algorithm === 'seminal') {
    console.log(' Seminal algorithm query check:', {
      algorithm,
      hasCitationFilter: !!query.cited_by_count,
      citationFilter: query.cited_by_count
    });
  }

  try {
    const startTime = Date.now();
    
    // Use find with hint for optimal index selection
    let queryBuilder = collection.find(query)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .maxTimeMS(8000); // 8 second timeout for date-filtered queries

    // Add index hints for better performance - prioritize date indexes when date filtering
    const hasDateFilter = year || (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number');
    const hasJournalFilter = journals.length > 0;
    const hasSubfieldFilter = subfields.length > 0;
    
    if (hasDateFilter && hasJournalFilter) {
      // Date + journal filtering: use compound index
      queryBuilder = queryBuilder.hint({ journal: 1, publication_date: -1 });
    } else if (hasDateFilter && hasSubfieldFilter) {
      // Date + subfield filtering: use compound index
      queryBuilder = queryBuilder.hint({ subfields: 1, publication_date: -1 });
    } else if (hasJournalFilter) {
      // Journal filtering only: use journal index
      queryBuilder = queryBuilder.hint({ journal: 1 });
    } else if (hasDateFilter) {
      // Date filtering only: use date index
      queryBuilder = queryBuilder.hint({ publication_date: -1 });
    } else if (hasSubfieldFilter) {
      queryBuilder = queryBuilder.hint({ subfields: 1 });
    } else if (algorithm === 'seminal') {
      // Seminal algorithm relies on citation sorting/filtering; prefer citation index
      queryBuilder = queryBuilder.hint({ cited_by_count: -1 });
    } else if (typeof minCitations === 'number' && minCitations > 0) {
      queryBuilder = queryBuilder.hint({ cited_by_count: -1 });
    } else {
      queryBuilder = queryBuilder.hint({ relevance_score: -1 });
    }

    const papers = await queryBuilder.toArray();
    const endTime = Date.now();
    
    console.log(` Batched query completed in ${endTime - startTime}ms, found ${papers.length} papers`);
    
    // Debug: Check citation counts in fetched papers for seminal algorithm
    if (algorithm === 'seminal') {
      const citationStats = {
        total: papers.length,
        withCitations: papers.filter((p: any) => (p.cited_by_count || 0) > 0).length,
        maxCitations: Math.max(...papers.map((p: any) => p.cited_by_count || 0)),
        sampleCitations: papers.slice(0, 5).map((p: any) => p.cited_by_count || 0)
      };
      console.log(' Seminal algorithm - fetched papers citation stats:', citationStats);
    }

    // For hasMore, we check if we got a full batch (simple heuristic)
    const hasMore = papers.length === limit;

    return {
      papers,
      hasMore,
      totalCount: page * limit + (hasMore ? 1 : 0) // Rough estimate for UI
    };

  } catch (error) {
    console.error(' Error in batched query:', error);
    
    // Fallback query - preserve user filters but simplify the query
    console.log(' Falling back to simplified query with user filters...');
    const fallbackQuery: any = {
      relevance_score: { $gte: 0.05 },
      publication_date: { $ne: null, $exists: true },
    };
    
    // Preserve subfield filter
    if (subfields.length > 0) {
      fallbackQuery.subfields = { $in: subfields };
    }
    
    // Preserve journal filter
    if (journals.length > 0) {
      fallbackQuery.journal = { $in: journals };
    }
    
    // Preserve citation filter
    if (typeof minCitations === 'number' && minCitations > 0) {
      fallbackQuery.cited_by_count = { $gte: minCitations };
    }
    // Ensure seminal algorithm still requires citations in fallback
    if (algorithm === 'seminal' && !fallbackQuery.cited_by_count) {
      fallbackQuery.cited_by_count = { $gte: 1 };
    }
    
    // Preserve simplified date filter (if user specified one)
    if (year) {
      // Simple year filter for fallback
      fallbackQuery.$or = [
        { publication_date: { $regex: `^${year}`, $options: 'i' } },
        { publication_date: parseInt(year) }
      ];
    } else if (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number') {
      // Simplified year range for fallback - only check string dates to avoid timeout
      const startDateStr = `${yearRangeStart}-01-01`;
      const endDateStr = `${yearRangeEnd}-12-31`;
      fallbackQuery.publication_date = {
        $type: "string",
        $gte: startDateStr,
        $lte: endDateStr
      };
    }

    console.log(' Fallback query:', JSON.stringify(fallbackQuery, null, 2));

    // Use algorithm-appropriate sort in fallback as well
    const fallbackSort = algorithm === 'relevance'
      ? { relevance_score: -1, cited_by_count: -1, publication_date: -1 }
      : { cited_by_count: -1, relevance_score: -1, publication_date: -1 };

    const papers = await collection.find(fallbackQuery)
      .sort(fallbackSort)
      .skip(skip)
      .limit(limit)
      .maxTimeMS(3000)
      .toArray();

    return {
      papers,
      hasMore: papers.length === limit,
      totalCount: page * limit + (papers.length === limit ? 1 : 0)
    };
  }
}

async function getEngagementMetrics(papers: any[], likesCollection: any, commentsCollection: any, bookmarksCollection: any, repostsCollection: any) {
  const paperIds = papers.map((paper: any) => paper._id?.toString() || paper.id);
  
  if (paperIds.length === 0) return { likesMap: new Map(), commentsMap: new Map(), bookmarksMap: new Map(), repostsMap: new Map() };

  try {
    const [likesCounts, commentsCounts, bookmarksCounts, repostsCounts] = await Promise.all([
      likesCollection.aggregate([
        { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } }
      ]).maxTimeMS(2000).toArray(),
      commentsCollection.aggregate([
        { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } }
      ]).maxTimeMS(2000).toArray(),
      bookmarksCollection.aggregate([
        { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } }
      ]).maxTimeMS(2000).toArray(),
      repostsCollection.aggregate([
        { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } }
      ]).maxTimeMS(2000).toArray()
    ]);

    return {
      likesMap: new Map(likesCounts.map((item: any) => [item._id, item.count])),
      commentsMap: new Map(commentsCounts.map((item: any) => [item._id, item.count])),
      bookmarksMap: new Map(bookmarksCounts.map((item: any) => [item._id, item.count])),
      repostsMap: new Map(repostsCounts.map((item: any) => [item._id, item.count]))
    };
  } catch (error) {
    console.error(' Error fetching engagement metrics:', error);
    return { likesMap: new Map(), commentsMap: new Map(), bookmarksMap: new Map(), repostsMap: new Map() };
  }
}

function applyEngagementBoost(papers: any[], engagementMaps: any) {
  return papers.map((paper: any) => {
    const paperId = paper._id?.toString() || paper.id;
    const likes = Number(engagementMaps.likesMap.get(paperId)) || 0;
    const comments = Number(engagementMaps.commentsMap.get(paperId)) || 0;
    const bookmarks = Number(engagementMaps.bookmarksMap.get(paperId)) || 0;
    const reposts = Number(engagementMaps.repostsMap.get(paperId)) || 0;
    
    const engagementScore = likes + comments * 2 + bookmarks * 3 + reposts * 2;
    
    // Apply engagement boost for papers with high interaction
    let engagementBoost = 0;
    if (engagementScore > 10) {
      engagementBoost = Math.min(engagementScore / 100, 0.5);
    }
    
    return {
      ...paper,
      likes,
      comments,
      bookmarks,
      reposts,
      engagementScore,
      engagementBoost
    };
  });
}

// Weighted seminal algorithm: 0.3 relevance + 0.4 citations + 0.1 likes + 0.2 randomness
function calculateWeightedSeminalScore(papers: any[]) {
  if (!papers || papers.length === 0) {
    return papers;
  }
  
  // Find max values for normalization
  const maxCitations = Math.max(...papers.map((p: any) => p.cited_by_count || 0));
  const maxLikes = Math.max(...papers.map((p: any) => p.likes || 0));
  const maxRelevance = Math.max(...papers.map((p: any) => p.relevance_score || 0));
  
  // If all papers have 0 citations/likes/relevance, ensure we don't divide by zero
  const citationNormalizer = maxCitations > 0 ? maxCitations : 1;
  const likesNormalizer = maxLikes > 0 ? maxLikes : 1;
  const relevanceNormalizer = maxRelevance > 0 ? maxRelevance : 1;
  
  console.log(' Weighted scoring normalization:', {
    totalPapers: papers.length,
    maxCitations,
    maxLikes,
    maxRelevance,
    sampleCitations: papers.slice(0, 5).map((p: any) => p.cited_by_count || 0)
  });
  
  return papers.map((paper: any) => {
    const citations = paper.cited_by_count || 0;
    const likes = paper.likes || 0;
    const relevance = paper.relevance_score || 0;
    
    // Normalize scores to 0-1 range
    const normalizedCitations = citations / citationNormalizer;
    const normalizedLikes = likes / likesNormalizer;
    const normalizedRelevance = relevance / relevanceNormalizer;
    const randomness = Math.random(); // 0-1 random value
    
    // Calculate weighted score (normalized to 1.0)
    const weightedScore = (
      normalizedRelevance * 0.3 +   // 30% relevance
      normalizedCitations * 0.4 +   // 40% citations
      normalizedLikes * 0.1 +       // 10% likes  
      randomness * 0.2              // 20% randomness
    );
    
    return {
      ...paper,
      weightedSeminalScore: weightedScore,
      normalizedRelevance,
      normalizedCitations,
      normalizedLikes,
      randomness
    };
  });
}

async function getSimpleUniversalPapers(
  collection: any,
  algorithm: string,
  page: number,
  limit: number,
  subfields: string[] = [],
  journals: string[] = [],
  minCitations?: number,
  year?: string,
  yearRangeStart?: number,
  yearRangeEnd?: number
) {
  console.log(' Using simple universal approach for better performance');
  
  const baseQuery: any = {};
  if (subfields.length > 0) {
    baseQuery.subfields = { $in: subfields };
  }
  
  if (journals.length > 0) {
    baseQuery.journal = { $in: journals };
  }

  try {
    // Calculate skip for pagination
    const skip = (page - 1) * limit;
    
    // Build the final query with algorithm-specific constraints
    const finalQuery: any = { ...baseQuery };

    // Projection to reduce payload and planner work
    const projection = {
      _id: 1,
      title: 1,
      abstract: 1,
      description: 1,
      authors: 1,
      publication_date: 1,
      cited_by_count: 1,
      doi: 1,
      subfields: 1,
      relevance_score: 1,
      journal: 1
    };
    
    // Define sort and hint based on algorithm and filters
    let sort: any;
    let hint: any | undefined;

    if (algorithm === 'relevance') {
      // Relevance: only ensure 2021+ by string-date range; avoid $or to prevent multiplanner
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
      // If a custom year range is provided, use that instead
      if (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number') {
        const startStr = `${yearRangeStart}-01-01`;
        const endStr = `${yearRangeEnd}-12-31`;
        finalQuery.$and = [
          {
            publication_date: {
              $type: 'string',
              $gte: startStr,
              $lte: endStr
            }
          }
        ];
      } else if (journals.length === 0) {
        // Only apply 2021+ filter when NOT filtering by journals
        // This allows journal-specific searches to return all historical papers
        finalQuery.$and = [
          {
            publication_date: {
              $type: 'string',
              $gte: '2021-01-01',
              $lte: currentDateStr
            }
          }
        ];
      }
      // Sort by publication date if we have date filtering, otherwise sort by relevance when filtering by journal
      if (journals.length > 0 && !finalQuery.$and) {
        // Journal filter without date filter: sort by relevance score
        sort = { relevance_score: -1, publication_date: -1 };
        hint = { journal: 1, relevance_score: -1 }; // Use journal + relevance compound index
      } else if (journals.length > 0) {
        // Journal filter with date filter
        sort = { publication_date: -1 };
        hint = { journal: 1, publication_date: -1 }; // Use journal + date compound index
      } else {
        // No journal filter
        sort = { publication_date: -1 };
        hint = { publication_date: -1 }; // Use date index (descending)
      }
      
      console.log(' Relevance algorithm: string-date 2021+ filter, publication_date desc');
      console.log(' Final query for relevance algorithm:', JSON.stringify(finalQuery, null, 2));
    } else {
      // Seminal: require citations and sort by citations primarily
      finalQuery.cited_by_count = { $gte: Math.max(1, Number(minCitations || 0)) };
      sort = { cited_by_count: -1 };
      
      // Choose hint based on filters
      if (journals.length > 0) {
        hint = { journal: 1, cited_by_count: -1 }; // Use journal + citation compound index
      } else {
        hint = { cited_by_count: -1 }; // Use citation index
      }
      
      console.log(' Seminal algorithm: Enforcing cited_by_count >= 1 and citation-first sort');
    }
    // Apply minCitations for relevance as well if provided by user
    if (algorithm === 'relevance' && typeof minCitations === 'number' && minCitations > 0) {
      finalQuery.cited_by_count = { $gte: minCitations };
    }
    
    // Use a broader relevance range when applicable to include more papers
    console.log(' Executing MongoDB query:', JSON.stringify(finalQuery, null, 2));
    // Try multiple hints to avoid multiplanner timeouts
    const hintsToTry = algorithm === 'seminal' 
      ? [hint, { cited_by_count: 1 }, undefined] 
      : [hint, undefined];
    let papers: any[] | null = null;
    let lastError: any = null;
    for (const h of hintsToTry) {
      try {
        let cursor = collection.find(finalQuery, { projection })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .maxTimeMS(15000);
        if (h) cursor = cursor.hint(h);
        papers = await cursor.toArray();
        break;
      } catch (e: any) {
        lastError = e;
        console.error(' Query attempt failed with hint', h, e?.message || e);
      }
    }
    if (!papers) throw lastError || new Error('All query attempts failed');

    console.log(` Simple universal query found ${papers.length} papers (page ${page}, skip ${skip})`);
    
    // Debug: Show sample papers and their publication dates
    if (papers.length > 0) {
      console.log(' Sample papers returned:');
      papers.slice(0, 3).forEach((paper: any, index: number) => {
        console.log(`  ${index + 1}. Title: "${paper.title?.substring(0, 50)}..."`);
        console.log(`     Publication date: "${paper.publication_date}" (type: ${typeof paper.publication_date})`);
        console.log(`     Relevance score: ${paper.relevance_score}`);
        console.log(`     Cited by: ${paper.cited_by_count}`);
      });
    }
    
    return papers;
  } catch (error) {
    console.error(' Error in simple universal query:', error);
    // Final fallback: just get any papers with minimal constraints
    const fallbackQuery: any = { ...baseQuery };
    const projection = {
      _id: 1,
      title: 1,
      abstract: 1,
      description: 1,
      authors: 1,
      publication_date: 1,
      cited_by_count: 1,
      doi: 1,
      subfields: 1,
      relevance_score: 1,
      journal: 1
    };
    let sort: any;
    let hint: any | undefined;

    if (algorithm === 'relevance') {
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
      if (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number') {
        const startStr = `${yearRangeStart}-01-01`;
        const endStr = `${yearRangeEnd}-12-31`;
        fallbackQuery.$and = [
          {
            publication_date: {
              $type: 'string',
              $gte: startStr,
              $lte: endStr
            }
          }
        ];
      } else {
        fallbackQuery.$and = [
          {
            publication_date: {
              $type: 'string',
              $gte: '2021-01-01',
              $lte: currentDateStr
            }
          }
        ];
      }
      sort = { publication_date: -1 };
      hint = { publication_date: -1 };
      console.log(' Relevance algorithm fallback: string-date 2021+ filter, publication_date desc');
    } else {
      fallbackQuery.cited_by_count = { $gte: Math.max(1, Number(minCitations || 0)) };
      sort = { cited_by_count: -1 };
      hint = { cited_by_count: -1 };
      console.log(' Seminal algorithm fallback: citation-first');
    }
    if (algorithm === 'relevance' && typeof minCitations === 'number' && minCitations > 0) {
      fallbackQuery.cited_by_count = { $gte: minCitations };
    }
    
    const hintsToTry = algorithm === 'seminal' 
      ? [hint, { cited_by_count: 1 }, undefined] 
      : [hint, undefined];
    for (const h of hintsToTry) {
      try {
        let cursor = collection.find(fallbackQuery, { projection })
          .sort(sort)
          .limit(limit)
          .maxTimeMS(15000);
        if (h) cursor = cursor.hint(h);
        return await cursor.toArray();
      } catch (e: any) {
        console.error(' Fallback query attempt failed with hint', h, e?.message || e);
      }
    }
    // Last resort: no hint
    return await collection.find(fallbackQuery, { projection })
      .sort(sort)
      .limit(limit)
      .maxTimeMS(15000)
      .toArray();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const algorithm = (searchParams.get("algorithm") || "relevance") as 'seminal' | 'relevance';
    const enableTiered = searchParams.get("enableTiered") === "true";
    const subfieldsParam = searchParams.get("subfields");
    const subfields = subfieldsParam ? subfieldsParam.split(',') : [];
    const journalsParam = searchParams.get("journals");
    const journals = journalsParam ? journalsParam.split(',').map(j => decodeURIComponent(j)) : [];
    const lastPaperId = searchParams.get("lastPaperId");
    const minCitationsParam = searchParams.get("minCitations");
    const minCitations = typeof minCitationsParam === 'string' ? Number(minCitationsParam) : undefined;
    const yearParam = searchParams.get("year");
    const year = yearParam && yearParam.trim() !== '' ? yearParam.trim() : undefined;
    const yearRangeStartParam = searchParams.get("yearRangeStart");
    const yearRangeEndParam = searchParams.get("yearRangeEnd");
    const yearRangeStart = typeof yearRangeStartParam === 'string' ? Number(yearRangeStartParam) : undefined;
    const yearRangeEnd = typeof yearRangeEndParam === 'string' ? Number(yearRangeEndParam) : undefined;
    
    // Map topic names to actual subfields in papers_clean
    let mappedSubfields: string[] = [];
    if (subfields.length > 0) {
      mappedSubfields = mapTopicsToSubfields(subfields);
      console.log(' Fast API: Original topics:', subfields);
      console.log(' Fast API: Mapped subfields:', mappedSubfields);
    }

    console.log(' Smart Batched Papers API called with:', {
      limit,
      page,
      algorithm,
      enableTiered,
      originalSubfields: subfields.length > 0 ? subfields : 'none',
      mappedSubfields: mappedSubfields.length > 0 ? mappedSubfields : 'none',
      journals: journals.length > 0 ? journals : 'none',
      lastPaperId,
      minCitations,
      year,
      yearRangeStart,
      yearRangeEnd,
    });
    
    // Use papers_clean collection for real data
    const collection = await getPapersCleanCollection();
    const likesCollection = await getLikesCollection();
    const commentsCollection = await getCommentsCollection();
    const bookmarksCollection = await getBookmarksCollection();
    const repostsCollection = await getRepostsCollection();
    
    console.log(' Got papers_clean collection');
    
    let papers: any[];
    if (enableTiered) {
      // Use simple universal approach for better performance
      console.log(' Calling getSimpleUniversalPapers with algorithm:', algorithm);
      papers = await getSimpleUniversalPapers(collection, algorithm, page, limit, mappedSubfields, journals, minCitations, year, yearRangeStart, yearRangeEnd);
    } else {
      // Fallback to original approach for backward compatibility
      const skip = (page - 1) * limit;
      const query: any = {
        publication_date: { $ne: null, $exists: true }
      };
      
      if (mappedSubfields.length > 0) {
        query.subfields = { $in: mappedSubfields };
      }
      
      if (journals.length > 0) {
        query.journal = { $in: journals };
      }
      
      // Projection to reduce payload
      const projection = {
        _id: 1,
        title: 1,
        abstract: 1,
        description: 1,
        authors: 1,
        publication_date: 1,
        cited_by_count: 1,
        doi: 1,
        subfields: 1,
        relevance_score: 1,
        journal: 1
      };

      // Algorithm-specific filters and sorts
      let sort: any;
      let hint: any | undefined;

      if (algorithm === 'relevance') {
        const now = new Date();
        const currentDateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
        if (typeof yearRangeStart === 'number' && typeof yearRangeEnd === 'number') {
          const startStr = `${yearRangeStart}-01-01`;
          const endStr = `${yearRangeEnd}-12-31`;
          query.$and = [
            {
              publication_date: {
                $type: 'string',
                $gte: startStr,
                $lte: endStr
              }
            }
          ];
        } else {
          query.$and = [
            {
              publication_date: {
                $type: 'string',
                $gte: '2021-01-01',
                $lte: currentDateStr
              }
            }
          ];
        }
        if (typeof minCitations === 'number' && minCitations > 0) {
          query.cited_by_count = { $gte: minCitations };
        }
        sort = { publication_date: -1 };
        hint = { publication_date: -1 };
        console.log(' Relevance algorithm (non-tiered): string-date filter, publication_date desc');
      } else {
        query.cited_by_count = { $gte: 1 };
        if (typeof minCitations === 'number' && minCitations > 1) {
          query.cited_by_count = { $gte: minCitations };
        }
        sort = { cited_by_count: -1, relevance_score: -1, publication_date: -1 };
        hint = { cited_by_count: -1 };
        console.log(' Seminal algorithm (non-tiered): Enforcing citation filter and citation-first sort');
      }
      
      let cursor = collection.find(query, { projection })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .maxTimeMS(5000);

      if (hint) {
        cursor = cursor.hint(hint);
      }

      papers = await cursor.toArray();
    }
    
    console.log(' Found papers from smart batched query:', papers.length);
    
    if (papers.length === 0) {
      return NextResponse.json({
        success: true,
        papers: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: page > 1
        },
        filters: { algorithm, subfields, journals, minCitations, year, yearRangeStart, yearRangeEnd },
        source: "papers_clean",
        tiered: enableTiered
      });
    }
    
    // Get engagement metrics
    const engagementMaps = await getEngagementMetrics(papers, likesCollection, commentsCollection, bookmarksCollection, repostsCollection);
    
    // Apply engagement boost
    const papersWithEngagement = applyEngagementBoost(papers, engagementMaps);
    
    // Apply weighted seminal algorithm if algorithm is 'seminal'
    let finalPapers = papersWithEngagement;
    if (algorithm === 'seminal') {
      console.log(' Applying weighted seminal scoring...');
      finalPapers = calculateWeightedSeminalScore(papersWithEngagement);
      
      // Sort by weighted seminal score (highest first)
      finalPapers.sort((a: any, b: any) => (b.weightedSeminalScore || 0) - (a.weightedSeminalScore || 0));
      
      console.log(' Sample weighted scores:', finalPapers.slice(0, 3).map((p: any) => ({
        title: p.title?.substring(0, 30),
        citations: p.cited_by_count,
        likes: p.likes,
        weightedScore: p.weightedSeminalScore?.toFixed(3),
        randomness: p.randomness?.toFixed(3)
      })));
    }
    
    // Transform to StaffPost format
    const transformedPapers = finalPapers.map((paper: any) => {
      const basePaper = transformMongoDBPaperToStaffPost(paper);
      
      return {
        ...basePaper,
        likes: paper.likes || 0,
        comments: paper.comments || 0,
        bookmarks: paper.bookmarks || 0,
        reposts: paper.reposts || 0,
        engagementScore: paper.engagementScore || 0,
        engagementBoost: paper.engagementBoost || 0,
        weightedSeminalScore: paper.weightedSeminalScore || undefined
      };
    });
    
    console.log(' Transformed papers with engagement data:', transformedPapers.length);
    
    // Calculate next cursor for infinite scroll
    const lastPaper = papers[papers.length - 1];
    const nextCursor = lastPaper ? lastPaper._id?.toString() : undefined;
    
    // Lightweight pagination metrics
    const hasMore = papers.length === limit;
    const totalCount = enableTiered ? papers.length * 10 : (page * limit + (hasMore ? 1 : 0));
    const totalPages = Math.ceil(totalCount / limit);
    
    console.log(' Pagination info:', { page, limit, totalCount, totalPages, hasMore });
    
    return NextResponse.json({
      success: true,
      papers: transformedPapers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: hasMore,
        hasPrev: page > 1
      },
      filters: { 
        algorithm, 
        subfields,
        journals,
        tiered: enableTiered,
        minCitations,
        year,
        yearRangeStart,
        yearRangeEnd,
      },
      source: "papers_clean",
      nextCursor,
      hasMore,
      tier: enableTiered ? 1 : 0,
      totalProcessed: papers.length
    });
    
  } catch (error) {
    console.error("Error fetching papers from papers_clean:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch papers from papers_clean", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
