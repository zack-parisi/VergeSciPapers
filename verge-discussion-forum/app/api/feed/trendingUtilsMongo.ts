import { fetchGrantsFromMongoDB, GrantFormat } from '../../../lib/mongodb-helpers';
import { getRepostsCollection, getUsersCollection, getStaffPostsCollection, getPostsCollection } from '../../../lib/mongodb-user-interactions.js';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


// Calculate trending score for grants (similar to papers but adapted for grants)
function calculateTrendingGrantScore({
  likes = 0,
  bookmarks = 0,
  comments = 0,
  createdAt,
}: {
  likes: number;
  bookmarks: number;
  comments: number;
  createdAt: string;
}): number {
  const now = new Date();
  const created = new Date(createdAt);
  const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  
  // Base score from engagement
  const engagementScore = likes * 1 + bookmarks * 2 + comments * 3;
  
  // Time decay factor (grants are less time-sensitive than papers)
  const timeDecay = Math.max(0.1, 1 - hoursSinceCreation / (24 * 30)); // 30 days half-life
  
  return engagementScore * timeDecay;
}

// Calculate trending score for reposts
function calculateTrendingRepostScore({
  likes = 0,
  comments = 0,
  createdAt,
  staffPostEngagement = 0,
}: {
  likes: number;
  comments: number;
  createdAt: string;
  staffPostEngagement?: number;
}): number {
  const now = new Date();
  const created = new Date(createdAt);
  const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  
  // Base score from engagement
  const engagementScore = likes * 1 + comments * 3 + staffPostEngagement * 0.5;
  
  // Time decay factor
  const timeDecay = Math.max(0.1, 1 - hoursSinceCreation / (24 * 7)); // 7 days half-life
  
  return engagementScore * timeDecay;
}

// Fetch and score all grants for trending
export async function getTrendingGrants(limit = 50): Promise<GrantFormat[]> {
  try {
    // Fetch grants from MongoDB
    const result = await fetchGrantsFromMongoDB({
      limit: limit * 2, // Get more for scoring
      page: 1
    });

    const grants = result.grants;

    // For now, since we don't have engagement data in MongoDB grants,
    // we'll score based on recency and some basic factors
    const scoredGrants = grants.map(grant => {
      const createdAt = grant.createdAt;
      const score = calculateTrendingGrantScore({
        likes: 0, // No likes data yet
        bookmarks: 0, // No bookmarks data yet
        comments: 0, // No comments data yet
        createdAt,
      });
      
      return { 
        ...grant, 
        likes: 0,
        bookmarks: 0,
        comments: 0,
        score 
      };
    });

    // Sort by score descending and return top N
    scoredGrants.sort((a, b) => b.score - a.score);
    return scoredGrants.slice(0, limit);
  } catch (error) {
    console.error("Error fetching trending grants from MongoDB:", error);
    return [];
  }
} 

// Fetch and score all reposts for trending from MongoDB
export async function getTrendingReposts(limit = 50) {
  try {
    const repostsCollection = await getRepostsCollection();
    const usersCollection = await getUsersCollection();
    const staffPostsCollection = await getStaffPostsCollection();
    const postsCollection = await getPostsCollection();
    
    // Fetch reposts from MongoDB
    const reposts = await repostsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Get more for scoring
      .toArray();

    console.log(' Found reposts in MongoDB:', reposts.length);

    // Populate user and staff post data
    const populatedReposts = await Promise.all(
      reposts.map(async (repost: any) => {
        const user = await usersCollection.findOne({ id: repost.userId });
        
        // Skip staff post lookup for Eureka reposts
        let staffPost = null;
        if (repost.targetType !== 'eureka_result') {
          // Use the embedded staffPost field if it exists, otherwise try to look it up
          staffPost = repost.staffPost;
          
          // Only do lookup if staffPost is not embedded
          if (!staffPost) {
            // Try to find in staff_posts collection (regular staff posts)
            staffPost = await staffPostsCollection.findOne({ _id: repost.staffPostId });
            if (!staffPost) {
              staffPost = await staffPostsCollection.findOne({ id: repost.staffPostId });
            }
            
            // If not found in staff_posts, try to find in papers_clean collection (MongoDB papers)
            if (!staffPost) {
              const { getPapersCleanCollection } = await import('../../../lib/mongodb-user-interactions.js');
              const papersCollection = await getPapersCleanCollection();
              const mongoPaper = await papersCollection.findOne({ _id: repost.staffPostId });
              
              if (mongoPaper) {
                // Transform MongoDB paper to staff post format
                staffPost = {
                  _id: mongoPaper._id,
                  id: mongoPaper._id.toString(),
                  userId: "system",
                  title: mongoPaper.title || "",
                  abstract: mongoPaper.abstract || "",
                  authors: (mongoPaper.authors || []).filter((author: any) => author !== null && author !== undefined),
                  subfields: mongoPaper.subfields || [],
                  citedByCount: mongoPaper.cited_by_count || 0,
                  publicationDate: mongoPaper.publication_date || new Date(),
                  doi: mongoPaper.doi || "",
                  linkId: mongoPaper._id.toString(),
                  citation: `${(mongoPaper.authors || []).filter((author: any) => author !== null && author !== undefined).join(", ") || "Unknown authors"} (${new Date(mongoPaper.publication_date).getFullYear()}). ${mongoPaper.title}. ${mongoPaper.journal || "Unknown journal"}. DOI: ${mongoPaper.doi}`,
                  relevanceScore: mongoPaper.relevance_score || 0,
                  journal: mongoPaper.journal || "",
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
              }
            }
          }
        }

        // Calculate trending score
        const createdAt = repost.createdAt;
        const score = calculateTrendingRepostScore({
          likes: 0, // No likes data yet in MongoDB
          comments: 0, // No comments data yet in MongoDB
          createdAt,
          staffPostEngagement: 0,
        });

        // Create response object
        const responseRepost: any = {
          _id: repost._id,
          id: repost.id,
          postId: repost.postId,
          userId: repost.userId,
          content: repost.content,
          createdAt: repost.createdAt,
          updatedAt: repost.updatedAt,
          staffPostId: repost.staffPostId,
          targetId: repost.targetId || staffPost?.linkId || staffPost?._id?.toString(),
          targetType: repost.targetType || 'staff_post', // Include targetType
          likes: 0,
          comments: 0,
          score,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          } : null,
          staffPost: staffPost ? {
            ...staffPost,
            id: staffPost._id.toString(),
            subfields: staffPost.subfields || [],
            authors: (staffPost.authors || []).filter((author: any) => author !== null && author !== undefined)
          } : null
        };
        
        // Always include eurekaData if it exists (for Eureka reposts)
        if (repost.targetType === 'eureka_result') {
          responseRepost.eurekaData = repost.eurekaData || null;
        } else if (repost.eurekaData) {
          // Include it for other types too if it exists
          responseRepost.eurekaData = repost.eurekaData;
        }
        
        return responseRepost;
      })
    );

    // Sort by score descending and return top N
    populatedReposts.sort((a: any, b: any) => b.score - a.score);
    console.log(' Returning trending reposts:', populatedReposts.length);
    return populatedReposts.slice(0, limit);
  } catch (error) {
    console.error("Error fetching trending reposts from MongoDB:", error);
    return [];
  }
} 