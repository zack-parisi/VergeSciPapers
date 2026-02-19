import { NextRequest, NextResponse } from "next/server";
import { 
  getRepostsCollection, 
  getUsersCollection, 
  getStaffPostsCollection,
  getPostsCollection,
  getPapersCollection,
  getPapersCleanCollection
} from "../../../../lib/mongodb-user-interactions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffPostId = searchParams.get("staffPostId");
  const userId = searchParams.get("userId");
  const postId = searchParams.get("postId");
  const subfieldsParam = searchParams.get("subfields");
  const subfieldNames = subfieldsParam ? decodeURIComponent(subfieldsParam).split(',') : [];
  const keyword = searchParams.get("keyword") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;
  
  console.log(' Reposts API called with:', {
    subfieldsParam,
    subfieldNames,
    page,
    limit,
    offset,
    staffPostId,
    userId,
    postId
  });
  
  try {
    const repostsCollection = await getRepostsCollection();
    const usersCollection = await getUsersCollection();
    const staffPostsCollection = await getStaffPostsCollection();
    
    // Build query
    let query: any = {};
    
    if (postId) {
      // Fetch a specific repost by its postId (for viewing individual repost in forum)
      query.postId = postId;
    } else if (staffPostId) {
      query.staffPostId = staffPostId;
    } else if (userId) {
      query.userId = userId;
    }

    // Get reposts with basic info
    let reposts = await repostsCollection.find(query).toArray();
    console.log(' Initial reposts found:', reposts.length);
    
    // If subfields filter is applied, we need to filter by embedded staff post subfields
    if (subfieldNames.length > 0) {
      console.log(' Filtering by subfields:', subfieldNames);
      
      const beforeFilterCount = reposts.length;
      
      // Filter reposts based on their embedded staff post subfields
      reposts = reposts.filter((repost: any) => {
        // Skip Eureka reposts from subfield filtering (they don't have staff posts)
        if (repost.targetType === 'eureka_result') {
          console.log(' Eureka repost - skipping subfield filter:', repost.id);
          return true; // Include Eureka reposts
        }
        
        // Check if repost has embedded staff post data
        if (repost.staffPost && repost.staffPost.subfields) {
          const repostSubfields = repost.staffPost.subfields;
          console.log(' Checking repost subfields:', repostSubfields);
          
          // Check if any of the selected subfields match the repost's subfields
          const hasMatchingSubfield = subfieldNames.some(selectedSubfield => 
            repostSubfields.includes(selectedSubfield)
          );
          
          if (hasMatchingSubfield) {
            console.log(' Repost matches subfield:', repost.staffPost.title);
          }
          
          return hasMatchingSubfield;
        }
        
        // If no embedded staff post data, skip this repost
        console.log(' Repost has no embedded staff post data:', repost.id);
        return false;
      });
      
      console.log(' Reposts after subfield filtering:', reposts.length, 'from', beforeFilterCount);
      
      // Log some sample reposts to see their structure
      if (reposts.length > 0) {
        console.log(' Sample matching repost:', {
          id: reposts[0].id,
          staffPostId: reposts[0].staffPostId,
          title: reposts[0].staffPost?.title,
          subfields: reposts[0].staffPost?.subfields
        });
      }
    } else {
      console.log(' No subfields provided, returning all reposts');
    }

    // If keyword filter is applied, search in staff post titles
    if (keyword.trim()) {
      const matchingStaffPosts = await staffPostsCollection
        .find({ title: { $regex: keyword.trim(), $options: 'i' } })
        .project({ _id: 1 })
        .toArray();
      
      const matchingStaffPostIds = matchingStaffPosts.map((sp: any) => sp._id.toString());
      reposts = reposts.filter((repost: any) => matchingStaffPostIds.includes(repost.staffPostId));
    }
    
    // Sort reposts
    if (sortBy === 'publicationDate') {
      // For publication date sorting, we need to fetch staff posts and sort by their dates
      const repostIds = reposts.map((r: any) => r._id);
      const repostsWithStaffPosts = await repostsCollection.aggregate([
        { $match: { _id: { $in: repostIds } } },
        {
          $lookup: {
            from: 'staff_posts',
            localField: 'staffPostId',
            foreignField: '_id',
            as: 'staffPost'
          }
        },
        { $unwind: '$staffPost' },
        { $sort: { 'staffPost.publicationDate': sortOrder === 'desc' ? -1 : 1 } }
      ]).toArray();
      reposts = repostsWithStaffPosts;
    } else {
      // Sort by createdAt
      reposts.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return sortOrder === 'desc' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
      });
    }
    
    // Apply pagination
    const totalCount = reposts.length;
    reposts = reposts.slice(offset, offset + limit);
    
    // Populate user and staff post data
    console.log(" About to populate reposts, count:", reposts.length);
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
                  authors: mongoPaper.authors || [],
                  subfields: mongoPaper.subfields || [],
                  citedByCount: mongoPaper.cited_by_count || 0,
                  publicationDate: mongoPaper.publication_date || new Date(),
                  doi: mongoPaper.doi || "",
                  linkId: mongoPaper._id.toString(),
                  citation: `${mongoPaper.authors?.join(", ") || "Unknown authors"} (${new Date(mongoPaper.publication_date).getFullYear()}). ${mongoPaper.title}. ${mongoPaper.journal || "Unknown journal"}. DOI: ${mongoPaper.doi}`,
                  relevanceScore: mongoPaper.relevance_score || 0,
                  journal: mongoPaper.journal || "",
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
              }
            }
          }
        }
        
        // Debug: Log the repost data to see what fields are present
        console.log(" Repost API - Original repost data:", {
          _id: repost._id,
          id: repost.id,
          postId: repost.postId,
          userId: repost.userId,
          content: repost.content?.substring(0, 30) + "...",
          hasEmbeddedStaffPost: !!repost.staffPost,
          staffPostId: repost.staffPostId,
          foundStaffPost: !!staffPost,
          targetType: repost.targetType,
          hasEurekaData: !!repost.eurekaData,
          eurekaDataKeys: repost.eurekaData ? Object.keys(repost.eurekaData) : null
        });
        
        // Create the response object explicitly to avoid field conflicts
        const responseRepost: any = {
          _id: repost._id,
          id: repost.id, // MongoDB document ID
          postId: repost.postId, // Actual repost UUID (this is what we want for navigation)
          userId: repost.userId,
          content: repost.content,
          createdAt: repost.createdAt,
          updatedAt: repost.updatedAt,
          staffPostId: repost.staffPostId,
          targetId: repost.targetId || staffPost?.linkId || staffPost?._id?.toString(),
          targetType: repost.targetType || 'staff_post', // Include targetType
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
        
        // Always include eurekaData if it exists (even if null/undefined, include it for Eureka reposts)
        if (repost.targetType === 'eureka_result') {
          responseRepost.eurekaData = repost.eurekaData || null;
        } else if (repost.eurekaData) {
          // Include it for other types too if it exists
          responseRepost.eurekaData = repost.eurekaData;
        }
        
        return responseRepost;
      })
    );
    
    // Debug: Check what the populated reposts look like
    console.log(" Populated reposts result:", populatedReposts.map((r: any) => ({
      _id: r._id,
      id: r.id,
      postId: r.postId,
      userId: r.userId,
      hasStaffPost: !!r.staffPost,
      staffPostTitle: r.staffPost?.title,
      targetType: r.targetType,
      hasEurekaData: !!r.eurekaData,
      eurekaDataKeys: r.eurekaData ? Object.keys(r.eurekaData) : null
    })));
    
    console.log(' Returning reposts API response:', {
      repostsCount: populatedReposts.length,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      }
    });
    
    return NextResponse.json({
      reposts: populatedReposts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      }
    });
  } catch (error) {
    console.error("Failed to fetch reposts:", error);
    return NextResponse.json({ error: "Failed to fetch reposts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId, staffPostId, content } = await req.json();
  if (!userId || !staffPostId) {
    return NextResponse.json({ error: "Missing userId or staffPostId" }, { status: 400 });
  }
  
  console.log(' Creating repost with:', { userId, staffPostId, contentLength: content?.length });
  
  try {
    const usersCollection = await getUsersCollection();
    const repostsCollection = await getRepostsCollection();
    const postsCollection = await getPostsCollection();
    const staffPostsCollection = await getStaffPostsCollection();
    
    // Check if user can interact (has .edu email)
    const user = await usersCollection.findOne(
      { id: userId },
      { projection: { canInteract: 1 } }
    );

    if (!user?.canInteract) {
      return NextResponse.json({ 
        error: "Institution email required", 
        message: "You need to be registered with an institution email (.edu) to create reposts." 
      }, { status: 403 });
    }

    // Verify staff post exists - try multiple lookup strategies
    let staffPost = null;
    
    console.log(' Looking for staff post with ID:', staffPostId);
    
    // First, try to find in staff_posts collection (regular staff posts)
    staffPost = await staffPostsCollection.findOne({ _id: staffPostId });
    if (!staffPost) {
      console.log(' Not found by _id, trying by id field');
      staffPost = await staffPostsCollection.findOne({ id: staffPostId });
    }
    
    // If not found in staff_posts, try to find in papers_clean collection (MongoDB papers)
    if (!staffPost) {
      console.log(' Not found in staff_posts, trying papers_clean collection');
      const papersCollection = await getPapersCleanCollection();
      const mongoPaper = await papersCollection.findOne({ _id: staffPostId });
      
      if (mongoPaper) {
        console.log(' Found paper in papers_clean:', mongoPaper.title);
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
      } else {
        console.log(' Paper not found in papers_clean collection');
      }
    }
    
    if (!staffPost) {
      return NextResponse.json({ error: "Staff post not found" }, { status: 404 });
    }

    // 1. Create a new Post record for the repost
    const post = {
      id: crypto.randomUUID(),
      userId,
      content: content || "",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await postsCollection.insertOne(post);
    
    // 2. Create the Repost record with embedded staff post data
    const repost = {
      id: crypto.randomUUID(),
      userId,
      staffPostId: staffPost._id.toString(), // Use MongoDB _id as staffPostId
      content: content || null,
      postId: post.id,
      targetId: staffPost.linkId || staffPost._id.toString(), // Add targetId for comments
      createdAt: new Date(),
      updatedAt: new Date(),
      // Embed staff post data for performance
      staffPost: {
        ...staffPost,
        id: staffPost._id.toString()
      }
    };
    
    const result = await repostsCollection.insertOne(repost);
    
    // Return the created repost with populated data
    const createdRepost = {
      ...repost,
      _id: result.insertedId,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      staffPost: {
        ...staffPost,
        id: staffPost._id.toString(),
        subfields: staffPost.subfields || [],
        authors: staffPost.authors || []
      },
      post
    };
    
    return NextResponse.json(createdRepost);
  } catch (error) {
    console.error("Failed to create repost:", error);
    return NextResponse.json({ error: "Failed to create repost" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }
  
  try {
    const repostsCollection = await getRepostsCollection();
    const postsCollection = await getPostsCollection();
    
    // Delete the repost first, then the post
    await repostsCollection.deleteOne({ postId });
    await postsCollection.deleteOne({ id: postId });
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete repost:", e);
    return NextResponse.json({ error: "Failed to delete repost" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { postId, content } = await req.json();
  if (!postId || !content) {
    return NextResponse.json({ error: "Missing postId or content" }, { status: 400 });
  }
  
  try {
    const repostsCollection = await getRepostsCollection();
    
    const result = await repostsCollection.updateOne(
      { postId },
      { 
        $set: { 
          content,
          updatedAt: new Date()
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Repost not found" }, { status: 404 });
    }
    
    const updatedRepost = await repostsCollection.findOne({ postId });
    return NextResponse.json(updatedRepost);
  } catch (e) {
    console.error("Failed to update repost:", e);
    return NextResponse.json({ error: "Failed to update repost" }, { status: 500 });
  }
} 