import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tunable weights for the trending score
const WEIGHTS = {
  likes: 2,
  comments: 3,
  bookmarks: 2,
  reposts: 2,
  citedBy: 1,
  recency: 5,
  random: 1,
};

// Trending score calculation for a single staff post
function calculateTrendingScore({
  likes,
  comments,
  bookmarks,
  reposts,
  citedByCount,
  createdAt,
}: {
  likes: number;
  comments: number;
  bookmarks: number;
  reposts: number;
  citedByCount: number;
  createdAt: Date;
}): number {
  const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const recencyFactor = 1 / (hoursSince + 2); // Avoid division by zero
  const randomFactor = Math.random() * 0.1; // Small shuffle
  return (
    WEIGHTS.likes * Math.log10(1 + likes) +
    WEIGHTS.comments * Math.log10(1 + comments) +
    WEIGHTS.bookmarks * Math.log10(1 + bookmarks) +
    WEIGHTS.reposts * Math.log10(1 + reposts) +
    WEIGHTS.citedBy * Math.log10(1 + citedByCount) +
    WEIGHTS.recency * recencyFactor +
    WEIGHTS.random * randomFactor
  );
}

// Trending score calculation for a single repost
function calculateTrendingRepostScore({
  likes,
  comments,
  createdAt,
  staffPostEngagement = 0,
}: {
  likes: number;
  comments: number;
  createdAt: Date;
  staffPostEngagement?: number;
}): number {
  const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const recencyFactor = 1 / (hoursSince + 2);
  const randomFactor = Math.random() * 0.1;
  // Optionally boost by original staff post engagement
  return (
    2 * Math.log10(1 + likes) +
    3 * Math.log10(1 + comments) +
    5 * recencyFactor +
    1 * staffPostEngagement +
    1 * randomFactor
  );
}

// Trending score calculation for a single grant
function calculateTrendingGrantScore({
  likes,
  bookmarks,
  comments,
  createdAt,
}: {
  likes: number;
  bookmarks: number;
  comments: number;
  createdAt: Date;
}): number {
  const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const recencyFactor = 1 / (hoursSince + 2);
  const randomFactor = Math.random() * 0.1;
  return (
    2 * Math.log10(1 + likes) +
    2 * Math.log10(1 + bookmarks) +
    3 * Math.log10(1 + comments) +
    5 * recencyFactor +
    1 * randomFactor
  );
}

// Fetch and score all staff posts
export async function getTrendingStaffPosts(limit = 50) {
  // Efficiently aggregate all metrics in a single query per metric
  const [posts, likes, comments, bookmarks, reposts] = await Promise.all([
    prisma.staffPost.findMany({
      take: limit * 2, // Fetch more for sorting, then slice
      orderBy: { createdAt: 'desc' },
      include: { subfields: true, authors: true }, // Include subfields and authors
    }),
    prisma.staffPostLike.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
    }),
    prisma.comment.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
      where: { staffPostId: { not: null } },
    }),
    prisma.bookmark.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
      where: { staffPostId: { not: null } },
    }),
    prisma.repost.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
    }),
  ]);

  // Build lookup maps for fast access
  const likesMap = Object.fromEntries(likes.map((l: any) => [l.staffPostId, l._count.staffPostId]));
  const commentsMap = Object.fromEntries(comments.map((c: any) => [c.staffPostId, c._count.staffPostId]));
  const bookmarksMap = Object.fromEntries(bookmarks.map((b: any) => [b.staffPostId, b._count.staffPostId]));
  const repostsMap = Object.fromEntries(reposts.map((r: any) => [r.staffPostId, r._count.staffPostId]));

  // Calculate trending score for each post
  const scoredPosts = posts.map((post: any) => {
    const likes = likesMap[post.id] || 0;
    const comments = commentsMap[post.id] || 0;
    const bookmarks = bookmarksMap[post.id] || 0;
    const reposts = repostsMap[post.id] || 0;
    const citedByCount = post.citedByCount || 0;
    const createdAt = post.createdAt;
    const score = calculateTrendingScore({
      likes,
      comments,
      bookmarks,
      reposts,
      citedByCount,
      createdAt,
    });
    // Map subfields to array of names for frontend compatibility
    const subfields = post.subfields ? post.subfields.map((sf: any) => sf.name) : [];
    const authors = post.authors ? post.authors.map((a: any) => a.name) : [];
    return { ...post, likes, comments, bookmarks, reposts, score, subfields, authors };
  });

  // Sort by score descending and return top N
  scoredPosts.sort((a: any, b: any) => b.score - a.score);
  return scoredPosts.slice(0, limit);
}

// Fetch and score all reposts for trending
export async function getTrendingReposts(limit = 50) {
  // Fetch reposts and their engagement
  const [reposts, likes, comments, staffPostLikes, staffPostComments, staffPostReposts] = await Promise.all([
    prisma.repost.findMany({
      take: limit * 2,
      orderBy: { createdAt: 'desc' },
      include: {
        staffPost: { include: { subfields: true, authors: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.repostLike.groupBy({
      by: ['repostId'],
      _count: { repostId: true },
    }),
    prisma.comment.groupBy({
      by: ['postId'],
      _count: { postId: true },
      where: { postId: { not: null } },
    }),
    prisma.staffPostLike.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
    }),
    prisma.comment.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
      where: { staffPostId: { not: null } },
    }),
    prisma.repost.groupBy({
      by: ['staffPostId'],
      _count: { staffPostId: true },
    }),
  ]);

  // Build lookup maps
  const likesMap = Object.fromEntries(likes.map((l: any) => [l.repostId, l._count.repostId]));
  const commentsMap = Object.fromEntries(comments.map((c: any) => [c.postId, c._count.postId]));
  const staffPostLikesMap = Object.fromEntries(staffPostLikes.map((l: any) => [l.staffPostId, l._count.staffPostId]));
  const staffPostCommentsMap = Object.fromEntries(staffPostComments.map((c: any) => [c.staffPostId, c._count.staffPostId]));
  const staffPostRepostsMap = Object.fromEntries(staffPostReposts.map((r: any) => [r.staffPostId, r._count.staffPostId]));

  // Calculate trending score for each repost
  const scoredReposts = reposts.map((repost: any) => {
    const likes = likesMap[repost.id] || 0;
    const comments = commentsMap[repost.postId] || 0;
    // Boost by staff post engagement (likes + comments + reposts)
    let staffPostEngagement = 0;
    if (repost.staffPost) {
      staffPostEngagement =
        (staffPostLikesMap[repost.staffPost.id] || 0) +
        (staffPostCommentsMap[repost.staffPost.id] || 0) +
        (staffPostRepostsMap[repost.staffPost.id] || 0);
    }
    const createdAt = repost.createdAt;
    const score = calculateTrendingRepostScore({
      likes,
      comments,
      createdAt,
      staffPostEngagement,
    });
    // Map subfields and authors to array of names for frontend compatibility
    const staffPost = repost.staffPost
      ? {
          ...repost.staffPost,
          subfields: repost.staffPost.subfields
            ? repost.staffPost.subfields.map((sf: any) => sf.name)
            : [],
          authors: repost.staffPost.authors
            ? repost.staffPost.authors.map((a: any) => a.name)
            : [],
        }
      : null;
    // Add user info for frontend
    const user = repost.user
      ? {
          id: repost.user.id,
          firstName: repost.user.firstName,
          lastName: repost.user.lastName,
        }
      : null;
    return { ...repost, likes, comments, score, staffPost, user };
  });

  // Sort by score descending and return top N
  scoredReposts.sort((a: any, b: any) => b.score - a.score);
  return scoredReposts.slice(0, limit);
}

// Fetch and score all grants for trending
export async function getTrendingGrants(limit = 50) {
  // Fetch grants and their engagement
  const [grants, likes, bookmarks, comments] = await Promise.all([
    prisma.grant.findMany({
      take: limit * 2,
      orderBy: { createdAt: 'desc' },
      include: {
        subfields: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.grantLike.groupBy({
      by: ['grantId'],
      _count: { grantId: true },
    }),
    prisma.grantBookmark.groupBy({
      by: ['grantId'],
      _count: { grantId: true },
    }),
    prisma.comment.groupBy({
      by: ['grantId'],
      _count: { grantId: true },
      where: { grantId: { not: null } },
    }),
  ]);

  // Build lookup maps
  const likesMap = Object.fromEntries(likes.map(l => [l.grantId, l._count.grantId]));
  const bookmarksMap = Object.fromEntries(bookmarks.map(b => [b.grantId, b._count.grantId]));
  const commentsMap = Object.fromEntries(comments.map(c => [c.grantId, c._count.grantId]));

  // Calculate trending score for each grant
  const scoredGrants = grants.map(grant => {
    const likes = likesMap[grant.id] || 0;
    const bookmarks = bookmarksMap[grant.id] || 0;
    const comments = commentsMap[grant.id] || 0;
    const createdAt = grant.createdAt;
    const score = calculateTrendingGrantScore({
      likes,
      bookmarks,
      comments,
      createdAt,
    });
    // Map subfields to array of names for frontend compatibility
    const subfields = grant.subfields ? grant.subfields.map((sf: any) => sf.name) : [];
    // Add user info for frontend
    const user = grant.user
      ? {
          id: grant.user.id,
          firstName: grant.user.firstName,
          lastName: grant.user.lastName,
        }
      : null;
    return { ...grant, likes, bookmarks, comments, score, subfields, user };
  });

  // Sort by score descending and return top N
  scoredGrants.sort((a: any, b: any) => b.score - a.score);
  return scoredGrants.slice(0, limit);
}

// In-memory cache for trending staff posts
let trendingStaffPostsCache: any[] = [];
let seminalStaffPostsCache: any[] = [];
let relevanceStaffPostsCache: any[] = [];
let trendingStaffPostsCacheTimestamp: number = 0;
let seminalStaffPostsCacheTimestamp: number = 0;
let relevanceStaffPostsCacheTimestamp: number = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Recalculate and update the cache
async function refreshTrendingStaffPostsCache(limit = 50) {
  const posts = await getTrendingStaffPosts(limit);
  trendingStaffPostsCache = posts;
  trendingStaffPostsCacheTimestamp = Date.now();
}

// Get posts sorted by citation count (for seminal algorithm)
async function getSeminalStaffPosts(limit = 50) {
  console.log("Fetching seminal posts (Discover algorithm)...");
  
  try {
    // Get all posts with their metrics
    const posts = await prisma.staffPost.findMany({
      take: limit * 3, // Get more for scoring
      include: {
        subfields: true,
        authors: true,
      },
    });

    // Get engagement metrics
    const [likes, comments, bookmarks, reposts] = await Promise.all([
      prisma.staffPostLike.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
      }),
      prisma.comment.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
        where: { staffPostId: { not: null } },
      }),
      prisma.bookmark.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
        where: { staffPostId: { not: null } },
      }),
      prisma.repost.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
      }),
    ]);

    // Build lookup maps
    const likesMap = Object.fromEntries(likes.map((l: any) => [l.staffPostId, l._count.staffPostId]));
    const commentsMap = Object.fromEntries(comments.map((c: any) => [c.staffPostId, c._count.staffPostId]));
    const bookmarksMap = Object.fromEntries(bookmarks.map((b: any) => [b.staffPostId, b._count.staffPostId]));
    const repostsMap = Object.fromEntries(reposts.map((r: any) => [r.staffPostId, r._count.staffPostId]));

    // Calculate max values for normalization
    const maxCitations = Math.max(...posts.map((p: any) => p.citedByCount || 0));
    const maxDaysSincePub = Math.max(...posts.map((p: any) => {
      const daysSince = (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, daysSince);
    }));

    // Score each post using Seminal algorithm: 0.3 * Relevance + 0.4 * Citations + 0.1 * Social + 0.2 * Random
    const scoredPosts = posts.map((post: any) => {
      // Relevance component (using recency as proxy for relevance)
      const daysSincePub = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const Rnorm = maxDaysSincePub > 0 ? daysSincePub / maxDaysSincePub : 0;
      const Relevance = 1 - Rnorm; // Higher for newer posts
      
      // Citations component
      const citations = post.citedByCount || 0;
      const Cnorm = maxCitations > 0 ? citations / maxCitations : 0;

      // Social component (likes)
      const postLikes = likesMap[post.id] || 0;
      const postComments = commentsMap[post.id] || 0;
      const postBookmarks = bookmarksMap[post.id] || 0;
      const postReposts = repostsMap[post.id] || 0;
      
      const Social = Math.log10(1 + postLikes + postComments + postBookmarks + postReposts);
      const maxSocial = Math.max(...posts.map((p: any) => Math.log10(1 + (likesMap[p.id] || 0) + (commentsMap[p.id] || 0) + (bookmarksMap[p.id] || 0) + (repostsMap[p.id] || 0))));
      const SocialNorm = maxSocial > 0 ? Social / maxSocial : 0;

      // Random component
      const Random = Math.random();

      // Final score: 0.3 * Relevance + 0.4 * Citations + 0.1 * Social + 0.2 * Random
      const score = 0.3 * Relevance + 0.4 * Cnorm + 0.1 * SocialNorm + 0.2 * Random;

      return {
        ...post,
        score,
        likes: postLikes,
        comments: postComments,
        bookmarks: postBookmarks,
        reposts: postReposts,
        subfields: post.subfields ? post.subfields.map((sf: any) => sf.name) : [],
        authors: post.authors ? post.authors.map((a: any) => a.name) : [],
      };
    });

    // Sort by score and return top N
    scoredPosts.sort((a: any, b: any) => b.score - a.score);
    console.log("Found seminal posts:", scoredPosts.length);
    return scoredPosts.slice(0, limit);
    
  } catch (error) {
    console.error("Error in getSeminalStaffPosts:", error);
    return [];
  }
}

// Get posts sorted by relevance score (for current/discuss algorithm)
async function getRelevanceStaffPosts(limit = 50) {
  console.log("Fetching relevance posts (Discuss algorithm)...");
  
  try {
    // Get all posts with their metrics
    const posts = await prisma.staffPost.findMany({
      take: limit * 3, // Get more for scoring
      include: {
        subfields: true,
        authors: true,
      },
    });

    // Get engagement metrics
    const [likes, comments, bookmarks, reposts] = await Promise.all([
      prisma.staffPostLike.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
      }),
      prisma.comment.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
        where: { staffPostId: { not: null } },
      }),
      prisma.bookmark.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
        where: { staffPostId: { not: null } },
      }),
      prisma.repost.groupBy({
        by: ['staffPostId'],
        _count: { staffPostId: true },
      }),
    ]);

    // Build lookup maps
    const likesMap = Object.fromEntries(likes.map((l: any) => [l.staffPostId, l._count.staffPostId]));
    const commentsMap = Object.fromEntries(comments.map((c: any) => [c.staffPostId, c._count.staffPostId]));
    const bookmarksMap = Object.fromEntries(bookmarks.map((b: any) => [b.staffPostId, b._count.staffPostId]));
    const repostsMap = Object.fromEntries(reposts.map((r: any) => [r.staffPostId, r._count.staffPostId]));

    // Calculate max values for normalization
    const maxCitations = Math.max(...posts.map((p: any) => p.citedByCount || 0));
    const maxDaysSincePub = Math.max(...posts.map((p: any) => {
      const daysSince = (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, daysSince);
    }));

    // Score each post using Relevance algorithm: 0.6 * Relevance + 0.1 * Recency + 0.6 * Social + 0.2 * Random
    const scoredPosts = posts.map((post: any) => {
      // Relevance component (using recency as proxy for relevance)
      const daysSincePub = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const Rnorm = maxDaysSincePub > 0 ? daysSincePub / maxDaysSincePub : 0;
      const Relevance = 1 - Rnorm; // Higher for newer posts
      
      // Recency component (additional recency boost)
      const Recency = 1 - Rnorm;

      // Social component (likes)
      const postLikes = likesMap[post.id] || 0;
      const postComments = commentsMap[post.id] || 0;
      const postBookmarks = bookmarksMap[post.id] || 0;
      const postReposts = repostsMap[post.id] || 0;
      
      const Social = Math.log10(1 + postLikes + postComments + postBookmarks + postReposts);
      const maxSocial = Math.max(...posts.map((p: any) => Math.log10(1 + (likesMap[p.id] || 0) + (commentsMap[p.id] || 0) + (bookmarksMap[p.id] || 0) + (repostsMap[p.id] || 0))));
      const SocialNorm = maxSocial > 0 ? Social / maxSocial : 0;

      // Random component
      const Random = Math.random();

      // Final score: 0.6 * Relevance + 0.1 * Recency + 0.6 * Social + 0.2 * Random
      const score = 0.6 * Relevance + 0.1 * Recency + 0.6 * SocialNorm + 0.2 * Random;

      return {
        ...post,
        score,
        likes: postLikes,
        comments: postComments,
        bookmarks: postBookmarks,
        reposts: postReposts,
        subfields: post.subfields ? post.subfields.map((sf: any) => sf.name) : [],
        authors: post.authors ? post.authors.map((a: any) => a.name) : [],
      };
    });

    // Sort by score and return top N
    scoredPosts.sort((a: any, b: any) => b.score - a.score);
    console.log("Found relevance posts:", scoredPosts.length);
    return scoredPosts.slice(0, limit);
    
  } catch (error) {
    console.error("Error in getRelevanceStaffPosts:", error);
    return [];
  }
}

// Helper function to fetch subfields and authors for posts
async function fetchPostRelations(posts: any[]) {
  console.log("Fetching relations for", posts.length, "posts");
  
  const postsWithRelations = await Promise.all(
    posts.map(async (post) => {
      const [subfields, authors] = await Promise.all([
        prisma.$queryRaw`
          SELECT s.name
          FROM _StaffPostSubfields sps
          JOIN Subfield s ON sps.B = s.id
          WHERE sps.A = ${post.id}
        `,
        prisma.$queryRaw`
          SELECT name
          FROM StaffPostAuthor
          WHERE staffPostId = ${post.id}
        `
      ]);
      
      const result = {
        ...post,
        subfields: (subfields as any[]).map(sf => sf.name),
        authors: (authors as any[]).map(a => a.name),
        likes: 0, comments: 0, bookmarks: 0, reposts: 0, score: 0, // Add default values
      };
      
      return result;
    })
  );
  
  return postsWithRelations;
}

// Get cached trending staff posts, recalculate if expired or empty
export async function getCachedTrendingStaffPosts(limit = 50, algorithm = 'trending') {
  const now = Date.now();
  
  if (algorithm === 'seminal') {
    // For seminal, fetch posts sorted by citation count
    // Always fetch fresh data for seminal to ensure we get the latest
    return await getSeminalStaffPosts(limit);
  } else if (algorithm === 'relevance') {
    // For relevance, fetch posts sorted by relevance score
    // Always fetch fresh data for relevance to ensure we get the latest
    return await getRelevanceStaffPosts(limit);
  } else {
    // Default trending algorithm
    if (
      trendingStaffPostsCache.length === 0 ||
      now - trendingStaffPostsCacheTimestamp > CACHE_TTL_MS
    ) {
      await refreshTrendingStaffPostsCache(limit);
    }
    return trendingStaffPostsCache.slice(0, limit);
  }
}

// Schedule cache refresh every 2 minutes
if (typeof global !== 'undefined') {
  if (!(global as any)._trendingStaffPostsCacheInterval) {
    (global as any)._trendingStaffPostsCacheInterval = setInterval(
      () => refreshTrendingStaffPostsCache().catch(() => {}),
      CACHE_TTL_MS
    );
  }
}

export { trendingStaffPostsCacheTimestamp }; 