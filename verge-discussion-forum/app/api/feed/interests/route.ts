import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/mongodb/[...nextauth]";
import { getTopicsCollection, getUsersCollection, getPapersStagingCollection, getPapersCleanCollection, getLikesCollection, getBookmarksCollection, getCommentsCollection, getRepostsCollection } from "../../../../lib/mongodb-user-interactions";
import { mapTopicsToSubfields } from "../../../../lib/topic-mapping";
import { ObjectId } from "mongodb";

// Force dynamic rendering to prevent build-time execution
// Fixed import paths for Vercel deployment compatibility
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const algorithm = searchParams.get("algorithm") || "seminal";
    const offset = (page - 1) * limit;

    // Get user's research interests from user document
    const usersCollection = await getUsersCollection();
    // Use papers_clean collection for real data
    const papersCollection = await getPapersCleanCollection();
    const likesCollection = await getLikesCollection();
    const bookmarksCollection = await getBookmarksCollection();
    const commentsCollection = await getCommentsCollection();
    const repostsCollection = await getRepostsCollection();
    
    const user = await usersCollection.findOne({ id: session.userId });
    if (!user) {
      return NextResponse.json({ posts: [] });
    }
    
    const selectedTopicNames = user.researchInterests || [];
    
    if (selectedTopicNames.length === 0) {
      return NextResponse.json({ posts: [] });
    }
    
    console.log(' User research interests:', selectedTopicNames);
    
    // Map topic names to broader subfields that exist in papers_clean
    const mappedSubfields = mapTopicsToSubfields(selectedTopicNames);
    console.log(' Mapped to subfields:', mappedSubfields);
    
    // Build query using the mapped subfields
    let query: any = {};
    
    // Use the mapped subfields for querying papers_clean
    if (mappedSubfields.length > 0) {
      query.subfields = {
        $in: mappedSubfields
      };
    }
    
    console.log(' Using query:', JSON.stringify(query, null, 2));
    
    // Get papers from papers_clean that have subfields matching user's interests
    const papers = await papersCollection.find(query)
    .sort({ relevance_score: -1, publication_date: -1 })
    .skip(offset)
    .limit(limit * 3) // Get more for scoring
    .toArray();
    
    console.log(` Found ${papers.length} papers matching user interests from papers_clean`);
    console.log(` Original topics: ${selectedTopicNames.join(', ')}`);
    console.log(` Mapped subfields: ${mappedSubfields.join(', ')}`);
    
    if (papers.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // Get engagement metrics for all papers
    const paperIds = papers.map((paper: any) => paper.id || paper._id?.toString());
    
    // Get likes count for each paper
    const likesCounts = await likesCollection.aggregate([
      { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
      { $group: { _id: "$targetId", count: { $sum: 1 } } }
    ]).toArray();
    
    // Get bookmarks count for each paper
    const bookmarksCounts = await bookmarksCollection.aggregate([
      { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
      { $group: { _id: "$targetId", count: { $sum: 1 } } }
    ]).toArray();
    
    // Get comments count for each paper
    const commentsCounts = await commentsCollection.aggregate([
      { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
      { $group: { _id: "$targetId", count: { $sum: 1 } } }
    ]).toArray();
    
    // Get reposts count for each paper
    const repostsCounts = await repostsCollection.aggregate([
      { $match: { targetId: { $in: paperIds }, targetType: "mongodb_paper" } },
      { $group: { _id: "$targetId", count: { $sum: 1 } } }
    ]).toArray();
    
    // Check if current user has liked/bookmarked each paper
    const userLikes = await likesCollection.find({
      userId: session.userId,
      targetId: { $in: paperIds },
      targetType: "mongodb_paper"
    }).toArray();
    
    const userBookmarks = await bookmarksCollection.find({
      userId: session.userId,
      targetId: { $in: paperIds },
      targetType: "mongodb_paper"
    }).toArray();
    
    // Create lookup maps for engagement metrics
    const likesMap = new Map(likesCounts.map((item: any) => [item._id, item.count]));
    const bookmarksMap = new Map(bookmarksCounts.map((item: any) => [item._id, item.count]));
    const commentsMap = new Map(commentsCounts.map((item: any) => [item._id, item.count]));
    const repostsMap = new Map(repostsCounts.map((item: any) => [item._id, item.count]));
    const userLikesSet = new Set(userLikes.map((like: any) => like.targetId));
    const userBookmarksSet = new Set(userBookmarks.map((bookmark: any) => bookmark.targetId));

    // Calculate global stats for normalization
    const maxCitations = Math.max(...papers.map((p: any) => p.cited_by_count || 0));
    const maxRelevance = Math.max(...papers.map((p: any) => p.relevance_score || 0));

    // Score and sort papers
    const scoredPapers = papers.map((paper: any) => {
      const paperId = paper.id || paper._id?.toString();
      const likes = likesMap.get(paperId) || 0;
      const bookmarks = bookmarksMap.get(paperId) || 0;
      const comments = commentsMap.get(paperId) || 0;
      const reposts = repostsMap.get(paperId) || 0;
      
             // Calculate engagement score
       const engagementScore = (likes as number) + (bookmarks as number) * 2 + (comments as number) * 3 + (reposts as number) * 2;
      
      // Calculate algorithm-based score
      let algorithmScore = 0;
      if (algorithm === "seminal") {
        // Seminal: 0.3 relevance + 0.4 citations + 0.1 likes + 0.2 randomness
        const citationScore = maxCitations > 0 ? (paper.cited_by_count || 0) / maxCitations : 0;
        const relevanceScore = maxRelevance > 0 ? (paper.relevance_score || 0) / maxRelevance : 0;
        const likesScore = Math.max(...papers.map((p: any) => p.likes || 0)) > 0 ? (paper.likes || 0) / Math.max(...papers.map((p: any) => p.likes || 0)) : 0;
        const randomness = Math.random();
        algorithmScore = relevanceScore * 0.3 + citationScore * 0.4 + likesScore * 0.1 + randomness * 0.2;
      } else {
        // Relevance: 0.6 relevance + 0.1 recency + 0.6 likes + 0.2 randomness
        const relevanceScore = maxRelevance > 0 ? (paper.relevance_score || 0) / maxRelevance : 0;
        const recencyScore = paper.publication_date ? 
          Math.max(0, (new Date().getFullYear() - new Date(paper.publication_date).getFullYear()) / 10) : 0;
        const likesScore = Math.max(...papers.map((p: any) => p.likes || 0)) > 0 ? (paper.likes || 0) / Math.max(...papers.map((p: any) => p.likes || 0)) : 0;
        const randomness = Math.random();
        algorithmScore = relevanceScore * 0.6 + (1 - recencyScore) * 0.1 + likesScore * 0.6 + randomness * 0.2;
      }
      
      return {
        ...paper,
        engagementScore,
        algorithmScore,
        likes,
        bookmarks,
        comments,
        reposts,
        liked: userLikesSet.has(paperId),
        bookmarked: userBookmarksSet.has(paperId)
      };
    });

         // Sort by algorithm score first, then by engagement
     scoredPapers.sort((a: any, b: any) => {
       if (Math.abs(a.algorithmScore - b.algorithmScore) > 0.1) {
         return b.algorithmScore - a.algorithmScore;
       }
       return b.engagementScore - a.engagementScore;
     });

    // Take top papers
    const topPapers = scoredPapers.slice(0, limit);

    // Transform to StaffPost format
    const posts = topPapers.map((paper: any) => ({
      id: paper.id || paper._id?.toString(),
      userId: "system",
      title: paper.title || "",
      authors: paper.authors || [],
      publicationDate: paper.publication_date || new Date().toISOString(),
      citedByCount: paper.cited_by_count || 0,
      abstract: paper.abstract || "",
      doi: paper.doi || "",
      linkId: paper.id || paper._id?.toString(),
      citation: `${(paper.authors || []).join(", ")} (${new Date(paper.publication_date).getFullYear()}). ${paper.title}. ${paper.journal || "Unknown journal"}. DOI: ${paper.doi}`,
      subfields: paper.subfields || [],
      createdAt: paper.createdAt || new Date().toISOString(),
      relevanceScore: paper.relevance_score,
      journal: paper.journal || "",
      likes: paper.likes || 0,
      comments: paper.comments || 0,
      bookmarks: paper.bookmarks || 0,
      reposts: paper.reposts || 0,
      liked: paper.liked || false,
      bookmarked: paper.bookmarked || false
    }));

    console.log(` Returning ${posts.length} posts for research interests feed`);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total: posts.length,
        hasNext: posts.length === limit
      }
    });

  } catch (error) {
    console.error("Error in research interests feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch research interests feed" },
      { status: 500 }
    );
  }
} 