import { NextRequest, NextResponse } from "next/server";
import { getBookmarksCollection, getUsersCollection, getPapersCollection, getPapersCleanCollection, getStaffPostsCollection, getPostsCollection, getGrantsCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


// Helper function to generate numeric ID from string (same as in other APIs)
function generateNumericId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// POST: Bookmark an item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(' Bookmarks API POST request body:', body);
    
    let { userId, targetId, targetType, completePaperData, postId } = body;
    
    console.log(' Extracted bookmark values:', { userId, targetId, targetType, hasCompleteData: !!completePaperData });
    
    if (!userId || !targetId) {
      console.log(' Missing required bookmark fields:', { userId: !!userId, targetId: !!targetId });
      return NextResponse.json({ 
        error: "Missing userId or targetId" 
      }, { status: 400 });
    }

    // Define valid target types
    const validTargetTypes = ['staff_post', 'mongodb_paper', 'grant', 'repost', 'post', 'eureka_result', 'eureka_response'];

    // Auto-detect targetType if not provided or incorrect
    if (!targetType || !validTargetTypes.includes(targetType)) {
      if (targetId.startsWith('eureka:')) {
        targetType = 'eureka_result';
        console.log(" Auto-detected targetType as 'eureka_result' for Eureka ID:", targetId);
      } else if (targetId.startsWith('openalex:')) {
        targetType = 'mongodb_paper';
        console.log(" Auto-detected targetType as 'mongodb_paper' for OpenAlex ID:", targetId);
      } else if (targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId)) {
        targetType = 'mongodb_paper';
        console.log(" Auto-detected targetType as 'mongodb_paper' for MongoDB ObjectId:", targetId);
      } else {
        targetType = 'staff_post';
        console.log(" Auto-detected targetType as 'staff_post' for:", targetId);
      }
    }

    // Validate target type
    if (!validTargetTypes.includes(targetType)) {
      return NextResponse.json({ 
        error: "Invalid targetType. Must be one of: " + validTargetTypes.join(', ') 
      }, { status: 400 });
    }

    // Validate user exists
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const bookmarksCollection = await getBookmarksCollection();
    
    // Check if already bookmarked (check by userId and targetId, regardless of targetType)
    const existingBookmark = await bookmarksCollection.findOne({
      userId,
      targetId
    });

    if (existingBookmark) {
      console.log(" Found existing bookmark:", {
        existingTargetType: existingBookmark.targetType,
        newTargetType: targetType,
        targetId: targetId
      });
      
      // If the existing bookmark has a different targetType, update it to the correct one
      if (existingBookmark.targetType !== targetType) {
        console.log(" Updating existing bookmark targetType from", existingBookmark.targetType, "to", targetType);
        
        const updateResult = await bookmarksCollection.updateOne(
          { _id: existingBookmark._id },
          { 
            $set: { 
              targetType: targetType,
              updatedAt: new Date()
            } 
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          // Fetch and return the updated bookmark
          const updatedBookmark = await bookmarksCollection.findOne({ _id: existingBookmark._id });
          return NextResponse.json({ 
            success: true,
            bookmark: updatedBookmark,
            message: "Bookmark targetType updated"
          });
        }
      } else {
        // Same targetType, return existing bookmark
        return NextResponse.json({ 
          success: true,
          bookmark: existingBookmark,
          message: "Already bookmarked"
        });
      }
    }

    // Generate numeric ID for consistent comment lookup
    const generatedNumericId = generateNumericId(targetId);

    // Generate postId for saved content compatibility
    // For MongoDB papers, use the generated numeric ID as postId
    // For staff posts, use the existing postId or generate one
    const postIdForSavedContent = targetType === 'mongodb_paper' ? 
      generatedNumericId : 
      (postId || generatedNumericId);

    // Fetch the complete target data for all types
    let targetData = null;
    
    console.log(" Processing bookmark request:", { targetId, targetType, hasCompleteData: !!completePaperData });
    
    // If complete paper data is provided from frontend, use it directly
    if (completePaperData) {
      console.log(" Using complete paper data from frontend");
      targetData = createOptimizedPaperDataFromFrontend(completePaperData, targetType);
      
      // Skip all backend lookups since we have complete data
      console.log(" Skipping backend lookups - using frontend data");
    } else {
      // Fallback to backend lookup if no complete data provided
      console.log(" No complete data provided, falling back to backend lookup");
      try {
        if (targetType === 'staff_post') {
          // Enhanced MongoDB paper detection
          const isMongoDBPaper = isMongoDBPaperId(targetId);
          
          if (isMongoDBPaper) {
            // Fetch paper data from MongoDB papers collection using optimized indexes
            console.log(" Fetching MongoDB paper data for:", targetId);
            
            try {
              const papersCollection = await getPapersCleanCollection();
              
              // Use optimized _id lookup with timeout
              const startTime = Date.now();
              const paper = await fetchPaperWithTimeout(papersCollection, targetId);
              const lookupTime = Date.now() - startTime;
              
              console.log(` Paper lookup completed in ${lookupTime}ms`);
              
              if (paper) {
                console.log(" Found MongoDB paper:", paper.title || paper.display_name);
                targetData = createOptimizedPaperData(paper, 'mongodb_paper');
              } else {
                console.log(" MongoDB paper not found:", targetId);
                targetData = createFallbackPaperData(targetId, 'mongodb_paper');
              }
            } catch (timeoutError) {
              console.log(" Paper fetch timed out, creating basic entry for:", targetId);
              targetData = createFallbackPaperData(targetId, 'mongodb_paper');
            }
          } else if (targetId.startsWith('openalex:')) {
            // Handle OpenAlex papers
            console.log(" Processing OpenAlex paper:", targetId);
            targetData = createFallbackPaperData(targetId, 'mongodb_paper');
          } else {
            // Handle regular staff posts
            console.log(" Processing regular staff post:", targetId);
            const staffPostsCollection = await getStaffPostsCollection();
            const staffPost = await staffPostsCollection.findOne({ id: targetId });
            
            if (staffPost) {
              console.log(" Found staff post:", staffPost.title);
              targetData = createOptimizedPaperData(staffPost, 'staff_post');
            } else {
              console.log(" Staff post not found:", targetId);
              targetData = createFallbackPaperData(targetId, 'staff_post');
            }
          }
        } else if (targetType === 'mongodb_paper') {
          // Handle MongoDB papers
          console.log(" Processing MongoDB paper:", targetId);
          
          try {
            const papersCollection = await getPapersCleanCollection();
            const paper = await fetchPaperWithTimeout(papersCollection, targetId);
            
            if (paper) {
              console.log(" Found MongoDB paper:", paper.title || paper.display_name);
              targetData = createOptimizedPaperData(paper, 'mongodb_paper');
            } else {
              console.log(" MongoDB paper not found:", targetId);
              targetData = createFallbackPaperData(targetId, 'mongodb_paper');
            }
          } catch (timeoutError) {
            console.log(" Paper fetch timed out, creating basic entry for:", targetId);
            targetData = createFallbackPaperData(targetId, 'mongodb_paper');
          }
        } else if (targetType === 'grant') {
          // Handle grants
          console.log(" Processing grant:", targetId);
          const grantsCollection = await getGrantsCollection();
          const grant = await grantsCollection.findOne({ id: targetId });
          
          if (grant) {
            console.log(" Found grant:", grant.title);
            targetData = createOptimizedPaperData(grant, 'grant');
          } else {
            console.log(" Grant not found:", targetId);
            targetData = createFallbackPaperData(targetId, 'grant');
          }
        } else if (targetType === 'repost' || targetType === 'post') {
          // Handle reposts and posts
          console.log(" Processing repost/post:", targetId);
          const postsCollection = await getPostsCollection();
          const post = await postsCollection.findOne({ id: targetId });
          
          if (post) {
            console.log(" Found post:", post.content?.substring(0, 50));
            targetData = createOptimizedPaperData(post, targetType);
          } else {
            console.log(" Post not found:", targetId);
            targetData = createFallbackPaperData(targetId, targetType);
          }
        } else if (targetType === 'eureka_result') {
          // Handle Eureka results - use the complete data provided from frontend
          console.log(" Processing Eureka result:", targetId);
          if (completePaperData) {
            console.log(" Using complete Eureka data from frontend");
            targetData = {
              id: targetId,
              type: 'eureka_result',
              title: completePaperData.query || 'Eureka Search Result',
              content: completePaperData.content || '',
              mode: completePaperData.metadata?.mode || 'unknown',
              papers: completePaperData.papers || [],
              notes: completePaperData.metadata?.notes || [],
              timestamp: completePaperData.timestamp || new Date().toISOString(),
              completeEurekaData: completePaperData
            };
          } else {
            console.log(" No complete Eureka data provided");
            targetData = createFallbackPaperData(targetId, 'eureka_result');
          }
        }
      } catch (error) {
        console.error(" Error fetching target data:", error);
        // Continue without target data if fetch fails
      }
    }
    
    console.log(" Target data result:", targetData ? " Stored" : " Not stored");

    // Create new bookmark with target data and generated numeric ID
    const newBookmark = {
      userId,
      targetId,
      targetType,
      generatedNumericId, // NEW: Store the generated numeric ID for consistent comment lookup
      targetData, // Store the complete paper data
      postId: postIdForSavedContent, // Store the postId for saved content compatibility
      createdAt: new Date()
    };

    const result = await bookmarksCollection.insertOne(newBookmark);
    
    return NextResponse.json({ 
      success: true, 
      bookmark: { ...newBookmark, _id: result.insertedId }
    });

  } catch (error) {
    console.error("Error creating bookmark:", error);
    return NextResponse.json({ 
      error: "Failed to create bookmark" 
    }, { status: 500 });
  }
}

// DELETE: Remove bookmark
export async function DELETE(req: NextRequest) {
  try {
    const { userId, targetId, targetType } = await req.json();
    
    console.log(" DELETE bookmark request:", { userId, targetId, targetType });
    
    if (!userId || !targetId || !targetType) {
      console.log(" Missing required fields:", { userId, targetId, targetType });
      return NextResponse.json({ 
        error: "Missing userId, targetId, or targetType" 
      }, { status: 400 });
    }

    const bookmarksCollection = await getBookmarksCollection();
    
    // Log the query we're about to execute
    const query = { userId, targetId, targetType };
    console.log(" Searching for bookmark with query:", query);
    
    // First, let's see what bookmarks exist for this user and target
    const existingBookmarks = await bookmarksCollection.find({ 
      userId, 
      targetType 
    }).toArray();
    console.log(" Existing bookmarks for user and type:", existingBookmarks.length);
    console.log(" Existing bookmark targetIds:", existingBookmarks.map((b: any) => b.targetId));
    
    const result = await bookmarksCollection.deleteOne({
      userId,
      targetId,
      targetType
    });

    console.log(" Delete result:", { deletedCount: result.deletedCount });

    if (result.deletedCount === 0) {
      console.log(" Bookmark not found for deletion, trying alternative targetId format...");
      
      // Try alternative targetId format (number vs string)
      let alternativeTargetId = targetId;
      if (targetId === null || targetId === undefined) {
        console.log(" targetId is null or undefined, cannot proceed");
        return NextResponse.json({ 
          error: "Invalid targetId: cannot be null or undefined" 
        }, { status: 400 });
      }
      
      if (typeof targetId === 'string') {
        // Try converting to number
        const numericId = parseInt(targetId, 10);
        if (!isNaN(numericId)) {
          alternativeTargetId = numericId;
        }
      } else if (typeof targetId === 'number') {
        // Try converting to string
        alternativeTargetId = targetId.toString();
      }
      
      if (alternativeTargetId !== targetId) {
        console.log(" Trying alternative targetId format:", alternativeTargetId);
        const alternativeResult = await bookmarksCollection.deleteOne({
          userId,
          targetId: alternativeTargetId,
          targetType
        });
        
        console.log(" Alternative delete result:", { deletedCount: alternativeResult.deletedCount });
        
        if (alternativeResult.deletedCount > 0) {
          console.log(" Bookmark deleted successfully with alternative targetId format");
          return NextResponse.json({ success: true });
        }
      }
      
      console.log(" Bookmark not found for deletion with any targetId format");
      return NextResponse.json({ 
        error: "Bookmark not found" 
      }, { status: 404 });
    }

    console.log(" Bookmark deleted successfully");
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting bookmark:", error);
    return NextResponse.json({ 
      error: "Failed to delete bookmark" 
    }, { status: 500 });
  }
}

// GET: Get bookmark status and count
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType");
    const userId = searchParams.get("userId");
    const generatedNumericId = searchParams.get("generatedNumericId"); // NEW: Support generatedNumericId

    // Support both targetId and generatedNumericId queries
    if ((!targetId && !generatedNumericId) || !targetType) {
      return NextResponse.json({ 
        error: "Missing targetId/generatedNumericId or targetType" 
      }, { status: 400 });
    }

    const bookmarksCollection = await getBookmarksCollection();
    
    // Build query based on provided parameters
    let query: any = { targetType };
    
    if (targetId) {
      query.targetId = targetId;
    } else if (generatedNumericId) {
      query.generatedNumericId = parseInt(generatedNumericId);
    }
    
    // Get total bookmark count
    const bookmarkCount = await bookmarksCollection.countDocuments(query);

    let bookmarked = false;
    let bookmark = null;
    
    // Check if user has bookmarked this item
    if (userId) {
      const userQuery = { ...query, userId };
      bookmark = await bookmarksCollection.findOne(userQuery);
      bookmarked = !!bookmark;
    } else {
      // If no userId provided, just get the first bookmark matching the criteria
      bookmark = await bookmarksCollection.findOne(query);
    }

    return NextResponse.json({
      bookmarkCount,
      bookmarked,
      bookmark // Return the bookmark data if found
    });

  } catch (error) {
    console.error("Error getting bookmark status:", error);
    return NextResponse.json({ 
      error: "Failed to get bookmark status" 
    }, { status: 500 });
  }
} 

// Helper function to detect MongoDB paper IDs
function isMongoDBPaperId(targetId: string): boolean {
  return typeof targetId === 'string' && 
         (targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId)) || // MongoDB ObjectId
         targetId.startsWith('openalex:'); // OpenAlex ID
}

// Helper function to fetch paper with timeout using optimized indexes
async function fetchPaperWithTimeout(collection: any, targetId: string, idField: string = '_id'): Promise<any> {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Paper fetch timeout')), 3000) // Reduced timeout since we have indexes
  );
  
  const query = { [idField]: targetId };
  const paperPromise = collection.findOne(query);
  return await Promise.race([paperPromise, timeoutPromise]) as any;
}

// Helper function to fetch paper with search query
async function fetchPaperWithSearchQuery(collection: any, searchQuery: any): Promise<any> {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Paper fetch timeout')), 3000)
  );
  
  const paperPromise = collection.findOne(searchQuery);
  return await Promise.race([paperPromise, timeoutPromise]) as any;
}

// Helper function to create optimized paper data
function createOptimizedPaperData(paper: any, type: string) {
  return {
    id: paper._id || paper.id,
    title: paper.title || paper.display_name || "Untitled Paper",
    abstract: paper.abstract || paper.description || '',
    authors: paper.authors || [],
    subfields: paper.subfields || [],
    cited_by_count: paper.cited_by_count || 0,
    publication_date: paper.publication_date || new Date().toISOString(),
    doi: paper.doi || '',
    relevance_score: paper.relevance_score || 0,
    journal: paper.journal || '',
    type: type,
    // Store the complete paper data for easy access
    completePaperData: {
      _id: paper._id || paper.id,
      title: paper.title || paper.display_name,
      abstract: paper.abstract || paper.description,
      authors: paper.authors || [],
      subfields: paper.subfields || [],
      cited_by_count: paper.cited_by_count || 0,
      publication_date: paper.publication_date || new Date().toISOString(),
      doi: paper.doi || '',
      relevance_score: paper.relevance_score || 0,
      journal: paper.journal || '',
      // Add any other fields that might be useful
      ...paper
    }
  };
}

// Helper function to create optimized paper data from frontend
function createOptimizedPaperDataFromFrontend(completePaperData: any, type: string) {
  return {
    id: completePaperData._id || completePaperData.id,
    title: completePaperData.title || completePaperData.display_name || "Untitled Paper",
    abstract: completePaperData.abstract || completePaperData.description || '',
    authors: completePaperData.authors || [],
    subfields: completePaperData.subfields || [],
    citedByCount: completePaperData.cited_by_count || completePaperData.citedByCount || 0, // FIXED: Use camelCase
    publicationDate: completePaperData.publication_date || completePaperData.publicationDate || new Date().toISOString(), // FIXED: Use camelCase
    doi: completePaperData.doi || '',
    relevanceScore: completePaperData.relevance_score || completePaperData.relevanceScore || 0, // FIXED: Use camelCase
    journal: completePaperData.journal || '',
    linkId: completePaperData.id, // FIXED: Add linkId for source button
    citation: completePaperData.citation || '', // FIXED: Add citation field
    createdAt: completePaperData.createdAt || new Date().toISOString(), // FIXED: Add createdAt
    type: type,
    completePaperData: completePaperData
  };
}

// Helper function to create fallback paper data
function createFallbackPaperData(targetId: string, type: string) {
  return {
    id: targetId,
    title: `Paper ${targetId}`,
    abstract: `This is a paper with ID: ${targetId}`,
    authors: ['Unknown Author'],
    subfields: ['Research'],
    cited_by_count: 0,
    publication_date: new Date().toISOString(),
    doi: '',
    relevance_score: 0,
    journal: 'Unknown Journal',
    type: type,
    completePaperData: {
      _id: targetId,
      title: `Paper ${targetId}`,
      abstract: `This is a paper with ID: ${targetId}`,
      authors: ['Unknown Author'],
      subfields: ['Research'],
      cited_by_count: 0,
      publication_date: new Date().toISOString(),
      doi: '',
      relevance_score: 0,
      journal: 'Unknown Journal'
    }
  };
}

// Helper function to create enhanced fallback paper data
function createEnhancedFallbackPaperData(targetId: string, type: string) {
  return {
    id: targetId,
    title: `Paper ${targetId}`,
    abstract: `This is a paper with ID: ${targetId}`,
    authors: ['Unknown Author'],
    subfields: ['Research'],
    cited_by_count: 0,
    publication_date: new Date().toISOString(),
    doi: '',
    relevance_score: 0,
    journal: 'Unknown Journal',
    type: type,
    completePaperData: {
      _id: targetId,
      title: `Paper ${targetId}`,
      abstract: `This is a paper with ID: ${targetId}`,
      authors: ['Unknown Author'],
      subfields: ['Research'],
      cited_by_count: 0,
      publication_date: new Date().toISOString(),
      doi: '',
      relevance_score: 0,
      journal: 'Unknown Journal'
    }
  };
}

// Helper function to create optimized staff post data
function createOptimizedStaffPostData(staffPost: any) {
  return {
    id: staffPost.id,
    title: staffPost.title,
    abstract: staffPost.abstract || staffPost.content || '',
    authors: staffPost.authors || [],
    subfields: staffPost.subfields || [],
    citedByCount: staffPost.citedByCount || staffPost.cited_by_count || 0, // FIXED: Use camelCase
    publicationDate: staffPost.publicationDate || staffPost.publication_date || staffPost.createdAt || new Date().toISOString(), // FIXED: Use camelCase
    doi: staffPost.doi || '',
    relevanceScore: staffPost.relevanceScore || staffPost.relevance_score || 0, // FIXED: Use camelCase
    journal: staffPost.journal || '',
    linkId: staffPost.linkId || staffPost.id, // FIXED: Add linkId for source button
    citation: staffPost.citation || '', // FIXED: Add citation field
    createdAt: staffPost.createdAt || new Date().toISOString(), // FIXED: Add createdAt
    type: 'staff_post',
    completePaperData: staffPost
  };
}

// Helper function to create optimized post data
function createOptimizedPostData(post: any, targetType: string) {
  return {
    id: post.id,
    title: post.title || 'Post',
    abstract: post.content || '',
    authors: [post.authorName || 'Unknown'],
    subfields: post.subfields || [],
    cited_by_count: 0,
    publication_date: post.createdAt || new Date().toISOString(),
    doi: '',
    relevance_score: 0,
    journal: '',
    type: targetType,
    completePaperData: post
  };
} 