import { NextRequest, NextResponse } from "next/server";
import { getBookmarksCollection, getUsersCollection, getStaffPostsCollection, getPostsCollection, getRepostsCollection, getPapersStaffPostsCollection, getPapersCollection, getPapersStagingCollection, getUserDataPapersCollection } from "../../../../lib/mongodb-user-interactions";
import { getGrantsCollection } from "../../../../lib/mongodb";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


// Helper function to generate numeric ID from string
function generateNumericId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Helper function to format citation
function formatCitation(paperData: any): string {
  if (!paperData.authors || paperData.authors.length === 0) {
    return paperData.title || 'Unknown Paper';
  }
  
  const authors = Array.isArray(paperData.authors) 
    ? paperData.authors.join(', ') 
    : paperData.authors;
  
  const year = paperData.publication_date 
    ? new Date(paperData.publication_date).getFullYear()
    : '';
  
  const journal = paperData.journal || '';
  const doi = paperData.doi || '';
  
  let citation = `${authors} (${year}). ${paperData.title || 'Untitled'}`;
  if (journal) citation += `. ${journal}`;
  if (doi) citation += `. DOI: ${doi}`;
  
  return citation;
}

// GET /api/saved-content/mongodb?userId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    console.log(" Saved content API called with userId:", userId);

    if (!userId) {
      return NextResponse.json({ 
        error: "Missing userId parameter" 
      }, { status: 400 });
    }

    const bookmarksCollection = await getBookmarksCollection();
    const staffPostsCollection = await getStaffPostsCollection();
    const papersStaffPostsCollection = await getPapersStaffPostsCollection();
    const postsCollection = await getPostsCollection();
    const repostsCollection = await getRepostsCollection();

    // Get all bookmarks for the user
    const bookmarks = await bookmarksCollection.find({ userId }).toArray();
    console.log(" Found bookmarks:", bookmarks.length);

    // Debug: Log targetId values and their types
    console.log(" Bookmark targetId values:", bookmarks.map((b: any) => ({
      targetId: b.targetId,
      targetType: b.targetType,
      targetIdType: typeof b.targetId
    })));

    // Separate bookmarks by type
    const staffPostBookmarks = bookmarks.filter((b: any) => b.targetType === 'staff_post');
    const mongodbPaperBookmarks = bookmarks.filter((b: any) => b.targetType === 'mongodb_paper');
    const postBookmarks = bookmarks.filter((b: any) => b.targetType === 'post' || b.targetType === 'repost');
    const grantBookmarks = bookmarks.filter((b: any) => b.targetType === 'grant');
    const eurekaResponseBookmarks = bookmarks.filter((b: any) => b.targetType === 'eureka_response' || b.targetType === 'eureka_result');
    
    console.log(" Staff post bookmarks:", staffPostBookmarks.length);
    console.log(" MongoDB paper bookmarks:", mongodbPaperBookmarks.length);
    console.log(" Post bookmarks:", postBookmarks.length);
    console.log(" Grant bookmarks:", grantBookmarks.length);
    console.log(" Eureka response bookmarks:", eurekaResponseBookmarks.length);

    // For bookmarks without stored targetData, we'll fetch the data as fallback
    const bookmarksWithoutData = bookmarks.filter((b: any) => !b.targetData);
    console.log(" Bookmarks without stored data:", bookmarksWithoutData.length);
    
    // Initialize maps for fallback data
    let staffPostsMap = new Map();
    let postsMap = new Map();
    
    if (bookmarksWithoutData.length > 0) {
      // Only fetch data for bookmarks that don't have targetData stored
      const staffPostIds = bookmarksWithoutData
        .filter((b: any) => b.targetType === 'staff_post')
        .map((b: any) => b.targetId);
      
      const postIds = bookmarksWithoutData
        .filter((b: any) => b.targetType === 'post' || b.targetType === 'repost')
        .map((b: any) => b.targetId);
      
      // Fetch fallback data only if needed
      let staffPosts: any[] = [];
      let posts: any[] = [];
      
      if (staffPostIds.length > 0) {
        // Try user_data database first
        staffPosts = await staffPostsCollection.find({ 
          id: { $in: staffPostIds } 
        }).toArray();
        
        // If not found in user_data, try papers database
        if (staffPosts.length < staffPostIds.length) {
          const foundIds = new Set(staffPosts.map((sp: any) => sp.id));
          const missingIds = staffPostIds.filter((id: any) => !foundIds.has(id));
          
          if (missingIds.length > 0) {
            const papersStaffPosts = await papersStaffPostsCollection.find({ 
              id: { $in: missingIds } 
            }).toArray();
            staffPosts = [...staffPosts, ...papersStaffPosts];
          }
        }
      }
      
      if (postIds.length > 0) {
        posts = await postsCollection.find({ 
          id: { $in: postIds } 
        }).toArray();
      }
      
      // Create maps for fallback lookup
      staffPostsMap = new Map(staffPosts.map((sp: any) => [sp.id, sp]));
      postsMap = new Map(posts.map((p: any) => [p.id, p]));
    }

    // Transform bookmarks with stored target data
    const transformedBookmarks = await Promise.all(bookmarks.map(async (bookmark: any) => {
      console.log(" Processing bookmark:", {
        id: bookmark._id,
        targetId: bookmark.targetId,
        targetType: bookmark.targetType,
        postId: bookmark.postId,
        hasTargetData: !!bookmark.targetData,
        hasCompletePaperData: !!bookmark.targetData?.completePaperData,
        completePaperDataPostId: bookmark.targetData?.completePaperData?.postId,
        completePaperDataKeys: bookmark.targetData?.completePaperData ? Object.keys(bookmark.targetData.completePaperData) : null,
        targetDataKeys: bookmark.targetData ? Object.keys(bookmark.targetData) : null
      });
      if (bookmark.targetType === 'staff_post' || bookmark.targetType === 'mongodb_paper') {
        // Use stored target data if available, otherwise fall back to fetched data
        if (bookmark.targetData) {
          // Check if this is a MongoDB paper or regular staff post
          const isMongoDBPaper = bookmark.targetType === 'mongodb_paper' || bookmark.targetData.type === 'mongodb_paper' || bookmark.targetData.type === 'openalex_paper';
          
          if (isMongoDBPaper) {
            // Transform MongoDB paper data to staff post format
            return {
              id: bookmark._id,
              userId: bookmark.userId,
              targetId: bookmark.targetId,
              targetType: bookmark.targetType,
              createdAt: bookmark.createdAt,
              staffPost: {
                id: generateNumericId(bookmark.targetId), // FIXED: Generate numeric ID for forum routing
                targetId: bookmark.targetId, // Add original targetId for unbookmarking
                userId: bookmark.userId,
                title: bookmark.targetData.title,
                abstract: bookmark.targetData.abstract,
                authors: bookmark.targetData.authors || [],
                subfields: bookmark.targetData.subfields || [],
                citedByCount: bookmark.targetData.cited_by_count || 0, // FIXED: Proper field name
                publicationDate: bookmark.targetData.publication_date,
                doi: bookmark.targetData.doi || '',
                linkId: bookmark.targetData.id, // Use the paper ID as linkId
                citation: formatCitation(bookmark.targetData),
                relevanceScore: bookmark.targetData.relevance_score || 0,
                journal: bookmark.targetData.journal || '',
                createdAt: bookmark.createdAt,
                // Store complete paper data for easy access
                completePaperData: bookmark.targetData.completePaperData || bookmark.targetData,
                // Add additional fields for better display
                displayTitle: bookmark.targetData.title || 'Untitled Paper',
                displayAbstract: bookmark.targetData.abstract || 'No abstract available',
                displayAuthors: bookmark.targetData.authors?.join(', ') || 'Unknown Authors',
                displayJournal: bookmark.targetData.journal || 'Unknown Journal',
                displayDate: bookmark.targetData.publication_date ? new Date(bookmark.targetData.publication_date).toLocaleDateString() : 'Unknown Date'
              },
              post: null,
            };
          } else {
            // Regular staff post
            return {
              id: bookmark._id,
              userId: bookmark.userId,
              targetId: bookmark.targetId,
              targetType: bookmark.targetType,
              createdAt: bookmark.createdAt,
              staffPost: {
                id: generateNumericId(bookmark.targetId), // FIXED: Generate numeric ID for forum routing
                targetId: bookmark.targetId, // Add original targetId for unbookmarking
                userId: bookmark.userId,
                title: bookmark.targetData.title,
                abstract: bookmark.targetData.abstract,
                authors: bookmark.targetData.authors || [],
                subfields: bookmark.targetData.subfields || [],
                citedByCount: bookmark.targetData.citedByCount || bookmark.targetData.cited_by_count || 0, // FIXED: Handle both field names
                publicationDate: bookmark.targetData.publicationDate || bookmark.targetData.publication_date,
                doi: bookmark.targetData.doi || '',
                linkId: bookmark.targetData.linkId || bookmark.targetData.id, // FIXED: Proper field name
                citation: bookmark.targetData.citation || '',
                relevanceScore: bookmark.targetData.relevanceScore || bookmark.targetData.relevance_score || 0,
                journal: bookmark.targetData.journal || '',
                createdAt: bookmark.createdAt,
                completePaperData: bookmark.targetData.completePaperData || bookmark.targetData,
                // Add display fields for consistency
                displayTitle: bookmark.targetData.title || 'Untitled Post',
                displayAbstract: bookmark.targetData.abstract || bookmark.targetData.content || 'No content available',
                displayAuthors: bookmark.targetData.authors?.join(', ') || 'Unknown Authors',
                displayJournal: bookmark.targetData.journal || 'Staff Post',
                displayDate: bookmark.targetData.publication_date ? new Date(bookmark.targetData.publication_date).toLocaleDateString() : 'Unknown Date'
              },
              post: null,
            };
          }
        } else {
          // Fallback to fetched data
          const staffPost = staffPostsMap.get(bookmark.targetId);
          return {
            id: bookmark._id,
            userId: bookmark.userId,
            targetId: bookmark.targetId,
            targetType: bookmark.targetType,
            createdAt: bookmark.createdAt,
            staffPost: staffPost ? {
              id: generateNumericId(bookmark.targetId), // FIXED: Generate numeric ID for forum routing
              targetId: bookmark.targetId, // Add original targetId for unbookmarking
              userId: staffPost.userId || bookmark.userId,
              title: staffPost.title || staffPost.display_name || 'Untitled Post',
              abstract: staffPost.abstract || staffPost.content || '',
              authors: staffPost.authors || [],
              subfields: staffPost.subfields || [],
              citedByCount: staffPost.citedByCount || staffPost.cited_by_count || 0, // FIXED: Handle both field names
              publicationDate: staffPost.publicationDate || staffPost.publication_date || staffPost.createdAt,
              doi: staffPost.doi || '',
              linkId: staffPost.linkId || staffPost.id, // FIXED: Proper field name
              citation: staffPost.citation || '',
              relevanceScore: staffPost.relevanceScore || staffPost.relevance_score || 0,
              journal: staffPost.journal || '',
              createdAt: staffPost.createdAt || bookmark.createdAt,
              // Store complete data for consistency
              completePaperData: staffPost
            } : null,
            post: null,
          };
        }
      } else if (bookmark.targetType === 'post' || bookmark.targetType === 'repost') {
        // For reposts, we need to handle both cases: with postId and without postId
        if (bookmark.targetType === 'repost') {
          console.log(" Processing repost bookmark:", {
            targetId: bookmark.targetId,
            hasTargetData: !!bookmark.targetData,
            hasCompletePaperData: !!bookmark.targetData?.completePaperData,
            completePaperDataKeys: bookmark.targetData?.completePaperData ? Object.keys(bookmark.targetData.completePaperData) : null
          });
          
          if (bookmark.targetData) {
            // Get the postId from completePaperData
            const postId = bookmark.targetData.completePaperData?.postId || bookmark.postId;
            
            // Create staff post data from targetData
            const staffPostData = {
              id: generateNumericId(bookmark.targetId),
              targetId: bookmark.targetId,
              userId: bookmark.userId,
              title: bookmark.targetData.title,
              abstract: bookmark.targetData.abstract,
              authors: bookmark.targetData.authors || [],
              subfields: bookmark.targetData.subfields || [],
              citedByCount: bookmark.targetData.citedByCount || bookmark.targetData.cited_by_count || 0,
              publicationDate: bookmark.targetData.publicationDate || bookmark.targetData.publication_date,
              doi: bookmark.targetData.doi || '',
              linkId: bookmark.targetData.linkId || bookmark.targetData.id,
              citation: bookmark.targetData.citation || '',
              relevanceScore: bookmark.targetData.relevanceScore || bookmark.targetData.relevance_score || 0,
              journal: bookmark.targetData.journal || '',
              createdAt: bookmark.createdAt,
              completePaperData: bookmark.targetData.completePaperData || bookmark.targetData
            };
            
            // Try to fetch actual repost data and user information
            let actualRepost: any = null;
            let actualUser: any = null;
            
            if (postId) {
              console.log(" Trying to fetch repost from postId:", postId);
              
              // Query the reposts collection using the postId
              actualRepost = await repostsCollection.findOne({ postId: postId });
              
              // Debug: Let's see what's in the reposts collection
              console.log(" Checking reposts collection...");
              const allReposts = await repostsCollection.find({}).limit(5).toArray();
              console.log(" All reposts in collection:", allReposts.map((r: any) => ({
                _id: r._id,
                postId: r.postId,
                userId: r.userId,
                content: r.content
              })));
              
              if (actualRepost) {
                console.log(" Found repost in reposts collection:", {
                  repostId: actualRepost._id,
                  userId: actualRepost.userId,
                  content: actualRepost.content,
                  contentType: typeof actualRepost.content,
                  contentLength: actualRepost.content?.length || 0,
                  postId: actualRepost.postId,
                  staffPostId: actualRepost.staffPostId,
                  hasStaffPost: !!actualRepost.staffPost,
                  repostKeys: Object.keys(actualRepost)
                });
                
                // Fetch user information for the repost
                const usersCollection = await getUsersCollection();
                actualUser = await usersCollection.findOne({ id: actualRepost.userId });
                console.log(" User data from repost:", actualUser ? {
                  id: actualUser.id,
                  firstName: actualUser.firstName,
                  lastName: actualUser.lastName
                } : "User not found");
              } else {
                console.log(" Repost not found from postId:", postId);
                // Log sample reposts to debug
                const allReposts = await repostsCollection.find({}).limit(3).toArray();
                console.log(" Sample reposts in collection:", allReposts.map((r: any) => ({
                  _id: r._id,
                  userId: r.userId,
                  postId: r.postId,
                  content: r.content?.substring(0, 30)
                })));
              }
            }
            
            // Create repost structure - use actual data if available, otherwise synthetic
            const repostData = actualRepost ? {
              id: actualRepost.id || generateNumericId(actualRepost._id?.toString() || postId || bookmark.targetId),
              userId: actualRepost.userId,
              content: actualRepost.content || '',
              createdAt: actualRepost.createdAt || bookmark.createdAt,
              postId: actualRepost.postId, // Add the actual postId from repost data
            } : {
              id: generateNumericId(postId || bookmark.targetId),
              userId: bookmark.targetData.userId || bookmark.userId,
              content: bookmark.targetData.content || bookmark.targetData.completePaperData?.content || '',
              createdAt: bookmark.targetData.createdAt || bookmark.createdAt,
              postId: postId, // Add the postId from bookmark data
            };
            
            console.log(" Repost data structure:", {
              actualRepostContent: actualRepost?.content,
              actualRepostExists: !!actualRepost,
              actualRepostKeys: actualRepost ? Object.keys(actualRepost) : null,
              finalContent: repostData.content,
              hasActualRepost: !!actualRepost
            });
            
            const userData = actualUser || bookmark.targetData.user || {
              id: bookmark.targetData.userId || bookmark.userId,
              firstName: 'User',
              lastName: '',
              email: ''
            };
            
            // Use staff post data from the repost record if available, otherwise use bookmark data
            const finalStaffPostData = actualRepost?.staffPost ? {
              id: generateNumericId(actualRepost.staffPost.id),
              targetId: actualRepost.staffPost.id,
              userId: actualRepost.staffPost.userId,
              title: actualRepost.staffPost.title,
              abstract: actualRepost.staffPost.abstract,
              authors: actualRepost.staffPost.authors || [],
              subfields: actualRepost.staffPost.subfields || [],
              citedByCount: actualRepost.staffPost.citedByCount || 0,
              publicationDate: actualRepost.staffPost.publicationDate,
              doi: actualRepost.staffPost.doi || '',
              linkId: actualRepost.staffPost.linkId || actualRepost.staffPost.id,
              citation: actualRepost.staffPost.citation || '',
              relevanceScore: actualRepost.staffPost.relevanceScore || 0,
              journal: actualRepost.staffPost.journal || '',
              createdAt: actualRepost.staffPost.createdAt || bookmark.createdAt,
              completePaperData: actualRepost.staffPost
            } : bookmark.targetData.staffPost || staffPostData;
            
            const repost = {
              ...repostData,
              type: 'repost',
              targetId: bookmark.targetId, // Add the targetId from the bookmark for filtering
              staffPost: finalStaffPostData,
              completePaperData: actualRepost?.staffPost || bookmark.targetData.completePaperData || bookmark.targetData,
              // Add user information with first and last name
              user: userData,
              userFullName: userData.firstName && userData.lastName 
                ? `${userData.firstName} ${userData.lastName}`.trim() 
                : userData.firstName || userData.lastName || userData.id || bookmark.userId,
              // Add additional fields that might be needed
              likes: bookmark.targetData.likes || 0,
              comments: bookmark.targetData.comments || 0,
              score: bookmark.targetData.score || 0
            };
            
            console.log(" Created repost structure:", {
              repostId: repost.id,
              userId: repost.userId,
              userFullName: repost.userFullName,
              hasContent: !!repost.content,
              contentLength: repost.content?.length || 0,
              content: repost.content,
              contentType: typeof repost.content,
              hasStaffPost: !!repost.staffPost,
              staffPostTitle: repost.staffPost?.title,
              userFirstName: repost.user?.firstName,
              userLastName: repost.user?.lastName,
              repostKeys: Object.keys(repost)
            });
            
            return {
              id: bookmark._id,
              userId: bookmark.userId,
              targetId: bookmark.targetId,
              targetType: bookmark.targetType,
              createdAt: bookmark.createdAt,
              post: repost,
              staffPost: null,
            };
          }
        }
        
        // For regular posts or fallback
        if (bookmark.targetData) {
          return {
            id: bookmark._id,
            userId: bookmark.userId,
            targetId: bookmark.targetId,
            targetType: bookmark.targetType,
            createdAt: bookmark.createdAt,
            post: {
              ...bookmark.targetData,
              type: bookmark.targetType,
              targetId: bookmark.targetId, // Add targetId for filtering
              completePaperData: bookmark.targetData.completePaperData || bookmark.targetData
            },
            staffPost: null,
          };
        } else {
          // Fallback to fetched data
          const post = postsMap.get(bookmark.targetId);
          return {
            id: bookmark._id,
            userId: bookmark.userId,
            targetId: bookmark.targetId,
            targetType: bookmark.targetType,
            createdAt: bookmark.createdAt,
            post: post ? {
              ...post,
              type: bookmark.targetType,
              targetId: bookmark.targetId, // Add targetId for filtering
            } : null,
            staffPost: null,
          };
        }
      } else if (bookmark.targetType === 'eureka_response' || bookmark.targetType === 'eureka_result') {
        // Handle Eureka response bookmarks
        if (bookmark.targetData) {
          // Extract data from completePaperData (where the actual Eureka content is stored)
          const eurekaData = bookmark.targetData.completePaperData || bookmark.targetData;
          
          return {
            id: bookmark._id,
            userId: bookmark.userId,
            targetId: bookmark.targetId,
            targetType: bookmark.targetType,
            createdAt: bookmark.createdAt,
            eurekaResponse: {
              id: bookmark.targetId,
              targetId: bookmark.targetId,
              query: eurekaData.query || '',
              content: eurekaData.content || '',
              metadata: eurekaData.metadata || {},
              papers: eurekaData.papers || [],
              timestamp: eurekaData.timestamp || bookmark.createdAt,
              addedAt: bookmark.createdAt,
              completeData: eurekaData,
            },
            staffPost: null,
            post: null,
          };
        }
      }
      return bookmark;
    }));

    // Fetch grant data for grant bookmarks
    const grantsCollection = await getGrantsCollection();
    const transformedGrantBookmarks = await Promise.all(grantBookmarks.map(async (bookmark: any) => {
      // Handle both string and ObjectId formats
      let grant;
      try {
        // Try to find by ObjectId first
        const { ObjectId } = require('mongodb');
        grant = await grantsCollection.findOne({ _id: new ObjectId(bookmark.targetId) });
      } catch (e) {
        // If ObjectId conversion fails, try as string
        grant = await grantsCollection.findOne({ _id: bookmark.targetId });
      }
      
      if (grant) {
        return {
          id: grant._id.toString(),
          userId: "system",
          title: grant.title || "",
          agency: grant.agency || "",
          type: grant.type || "",
          description: grant.description || "",
          eligibility: grant.eligibility || "",
          amount: grant.amount || "",
          opportunityNumber: grant.opportunityNumber || "",
          dates: grant.dates || "",
          url: grant.url || "",
          createdAt: grant.scraped_at || new Date().toISOString(),
          subfields: [],
          user: {
            id: "system",
            firstName: "System",
            lastName: "User"
          }
        };
      }
      return null;
    }));

    const validGrants = transformedGrantBookmarks.filter(Boolean);

    // Extract Eureka responses from transformed bookmarks
    const eurekaResponses = transformedBookmarks
      .filter((b: any) => b.eurekaResponse)
      .map((b: any) => b.eurekaResponse);

    console.log(" Returning transformed bookmarks:", transformedBookmarks.length);
    console.log(" Returning grants:", validGrants.length);
    console.log(" Returning Eureka responses:", eurekaResponses.length);
    
    return NextResponse.json({
      bookmarks: transformedBookmarks,
      grants: validGrants,
      eurekaResponses: eurekaResponses
    });

  } catch (error) {
    console.error("Error fetching saved content:", error);
    return NextResponse.json({ 
      error: "Failed to fetch saved content" 
    }, { status: 500 });
  }
} 