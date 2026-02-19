import { NextRequest, NextResponse } from "next/server";
import { getSavedCategoriesCollection, getUsersCollection } from "../../../../lib/mongodb-user-interactions";
import { ObjectId } from "mongodb";

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

// Helper function to format citation like saved content API
function formatCitation(paperData: any): string {
  if (!paperData) return '';
  
  const authors = paperData.authors?.join(', ') || 'Unknown Authors';
  const title = paperData.title || 'Untitled';
  const journal = paperData.journal || '';
  const year = paperData.publication_date ? new Date(paperData.publication_date).getFullYear() : '';
  
  if (journal && year) {
    return `${authors}. ${title}. ${journal}. ${year}.`;
  } else if (year) {
    return `${authors}. ${title}. ${year}.`;
  } else {
    return `${authors}. ${title}.`;
  }
}

// GET: Get user's saved categories
export async function GET(req: NextRequest) {
  console.log(" GET /api/saved-categories/mongodb called");
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    console.log(" GET /api/saved-categories/mongodb - userId:", userId);

    if (!userId) {
      return NextResponse.json({ 
        error: "userId is required" 
      }, { status: 400 });
    }

    // Validate user exists
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Get all categories for the user
    const categories = await categoriesCollection.find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert _id to id for frontend compatibility and transform items structure
    const formattedCategories = await Promise.all(categories.map(async (category: any) => {
      // Transform items array into separate arrays for different content types
      const posts: any[] = [];
      const staffPosts: any[] = [];
      const grants: any[] = [];

      if (category.items && Array.isArray(category.items)) {
        // Process items sequentially to handle async operations
        for (const item of category.items) {
          console.log(" Processing category item:", {
            targetId: item.targetId,
            targetType: item.targetType,
            hasCompleteData: !!item.completeData,
            completeDataKeys: item.completeData ? Object.keys(item.completeData) : null
          });

          const itemData = {
            id: item.targetId,
            targetId: item.targetId,
            targetType: item.targetType,
            addedAt: item.addedAt,
            postId: item.postId || null, // Include postId for reposts
            userId: item.completeData?.userId || category.userId, // Include userId for user lookup
            ...(item.completeData && { completeData: item.completeData })
          };
          
          console.log(" Item data created:", {
            targetId: item.targetId,
            targetType: item.targetType,
            itemUserId: itemData.userId,
            completeDataUserId: item.completeData?.userId,
            categoryUserId: category.userId,
            hasCompleteData: !!item.completeData,
            completeDataKeys: item.completeData ? Object.keys(item.completeData) : null
          });

          switch (item.targetType) {
            case 'post':
              posts.push({
                ...itemData,
                type: item.targetType,
                ...(item.completeData && { ...item.completeData })
              });
              break;
            case 'repost':
              // Check both the saved category item's postId and the bookmark's targetData.postId
              const { getBookmarksCollection } = await import("../../../../lib/mongodb-user-interactions");
              const bookmarksCollection = await getBookmarksCollection();
              const bookmark = await bookmarksCollection.findOne({
                targetId: item.targetId,
                targetType: 'repost'
              });
              
              const bookmarkPostId = bookmark?.targetData?.postId;
              const itemPostId = item.postId;
              
              console.log(" Checking repost postId:", {
                targetId: item.targetId,
                itemPostId: itemPostId,
                bookmarkPostId: bookmarkPostId,
                hasBookmark: !!bookmark,
                bookmarkKeys: bookmark ? Object.keys(bookmark) : null,
                targetDataKeys: bookmark?.targetData ? Object.keys(bookmark.targetData) : null
              });
              
              // Skip reposts that don't have a valid postId or don't have a proper bookmark
              if (!bookmark || !itemPostId) {
                console.log(" Skipping repost:", {
                  targetId: item.targetId,
                  hasBookmark: !!bookmark,
                  itemPostId: itemPostId,
                  bookmarkPostId: bookmarkPostId,
                  reason: !bookmark ? "no bookmark found" : "null itemPostId"
                });
                break;
              }

              console.log(" Processing repost for category:", {
                targetId: item.targetId,
                itemPostId: itemPostId,
                hasCompleteData: !!item.completeData
              });
              
              // For reposts, we need to structure the data properly for display
              // The FeedCard component expects the repost data directly in the post object
              let repostData;
              
              if (item.completeData) {
                // Use the stored complete data if available
                repostData = {
                  ...itemData,
                  type: 'repost',
                  // Use the complete data structure directly as the post
                  id: item.completeData.id,
                  userId: item.completeData.userId,
                  content: item.completeData.content,
                  postId: item.completeData.postId,
                  staffPost: item.completeData.staffPost,
                  createdAt: item.completeData.createdAt,
                  updatedAt: item.completeData.updatedAt,
                  // Add the complete data for easy access
                  completeData: item.completeData,
                  targetId: item.targetId // Add targetId for filtering
                };
              } else {
                // If no complete data, fetch it from the reposts collection using postId
                console.log(" Fetching repost data for display:", {
                  itemPostId: item.postId,
                  itemTargetId: item.targetId,
                  itemCompleteData: !!item.completeData,
                  itemKeys: Object.keys(item)
                });
                
                try {
                  const { getRepostsCollection, getBookmarksCollection } = await import("../../../../lib/mongodb-user-interactions");
                  const repostsCollection = await getRepostsCollection();
                  const bookmarksCollection = await getBookmarksCollection();
                  
                  // Use the postId from the saved category item directly
                  let correctPostId = item.postId;
                  console.log(" Using postId from saved category item:", correctPostId);
                  
                  console.log(" Using postId for repost lookup:", {
                    originalPostId: item.postId,
                    bookmarkPostId: bookmark?.postId,
                    correctPostId: correctPostId
                  });
                  
                  const repostFromDB = await repostsCollection.findOne({ postId: correctPostId });
                  
                  if (repostFromDB) {
                    console.log(" Found repost data from database:", {
                      usedPostId: correctPostId,
                      repostId: repostFromDB._id,
                      content: repostFromDB.content?.substring(0, 30) + '...',
                      hasStaffPost: !!repostFromDB.staffPost
                    });
                    
                    // Fetch user information to get first and last name
                    const { getUsersCollection } = await import("../../../../lib/mongodb-user-interactions");
                    const usersCollection = await getUsersCollection();
                    
                    console.log(" Looking up user in user_data.users collection:", {
                      repostUserId: repostFromDB.userId,
                      collectionName: usersCollection.collectionName,
                      databaseName: usersCollection.dbName
                    });
                    
                    const user = await usersCollection.findOne({ id: repostFromDB.userId });
                    
                    console.log(" User lookup for repost:", {
                      repostUserId: repostFromDB.userId,
                      foundUser: !!user,
                      userKeys: user ? Object.keys(user) : null,
                      userFirstName: user?.firstName,
                      userLastName: user?.lastName,
                      userFullName: user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`.trim() 
                        : user?.firstName || user?.lastName || repostFromDB.userId
                    });
                    
                    const userFullName = user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`.trim() 
                      : user?.firstName || user?.lastName || repostFromDB.userId;
                    
                    repostData = {
                      ...itemData,
                      type: 'repost',
                      id: repostFromDB.id || repostFromDB._id?.toString(),
                      userId: repostFromDB.userId,
                      content: repostFromDB.content,
                      postId: repostFromDB.postId,
                      staffPost: repostFromDB.staffPost,
                      createdAt: repostFromDB.createdAt,
                      updatedAt: repostFromDB.updatedAt,
                      // Add user information with first and last name
                      user: user || { id: repostFromDB.userId },
                      userFullName: userFullName,
                      // Add the fetched data for future use
                      completeData: repostFromDB,
                      targetId: item.targetId // Add targetId for filtering
                    };
                  } else {
                    console.log(" Repost not found in database for postId:", correctPostId);
                    // Fallback structure when repost data is not found
                    // Try to get user information even for fallback
                    const { getUsersCollection } = await import("../../../../lib/mongodb-user-interactions");
                    const usersCollection = await getUsersCollection();
                    const user = await usersCollection.findOne({ id: itemData.userId });
                    
                    const userFullName = user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`.trim() 
                      : user?.firstName || user?.lastName || itemData.userId;
                    
                    repostData = {
                      ...itemData,
                      type: 'repost',
                      id: item.targetId,
                      userId: itemData.userId,
                      content: 'Content not available',
                      postId: item.postId,
                      staffPost: null,
                      createdAt: item.addedAt,
                      updatedAt: item.addedAt,
                      // Add user information with first and last name
                      user: user || { id: itemData.userId },
                      userFullName: userFullName,
                      targetId: item.targetId // Add targetId for filtering
                    };
                  }
                } catch (error) {
                  console.error(" Error fetching repost data:", error);
                  // Fallback structure when fetch fails
                  // Try to get user information even for error case
                  try {
                    const { getUsersCollection } = await import("../../../../lib/mongodb-user-interactions");
                    const usersCollection = await getUsersCollection();
                    const user = await usersCollection.findOne({ id: itemData.userId });
                    
                    const userFullName = user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`.trim() 
                      : user?.firstName || user?.lastName || itemData.userId;
                    
                    repostData = {
                      ...itemData,
                      type: 'repost',
                      id: item.targetId,
                      userId: itemData.userId,
                      content: 'Content not available',
                      postId: item.postId,
                      staffPost: null,
                      createdAt: item.addedAt,
                      updatedAt: item.addedAt,
                      // Add user information with first and last name
                      user: user || { id: itemData.userId },
                      userFullName: userFullName,
                      targetId: item.targetId // Add targetId for filtering
                    };
                  } catch (userError) {
                    console.error(" Error fetching user data:", userError);
                    // Final fallback without user data
                    repostData = {
                      ...itemData,
                      type: 'repost',
                      id: item.targetId,
                      userId: itemData.userId,
                      content: 'Content not available',
                      postId: item.postId,
                      staffPost: null,
                      createdAt: item.addedAt,
                      updatedAt: item.addedAt,
                      targetId: item.targetId // Add targetId for filtering
                    };
                  }
                }
              }
              
              // Check if the repost has a valid postId
              const repostPostId = repostData.postId;
              
              // Only add reposts that have a valid postId
              if (repostPostId !== null) {
                console.log(" Adding repost to posts array:", {
                  targetId: item.targetId,
                  postId: repostPostId,
                  userFullName: repostData.userFullName,
                  userId: repostData.userId
                });
                posts.push(repostData);
              } else {
                console.log(" Skipping repost with null postId:", {
                  targetId: item.targetId,
                  repostPostId: repostPostId
                });
              }
              break;
            case 'eureka_response':
            case 'eureka_result':
              // Eureka responses are stored with complete data
              const eurekaResponseData = {
                ...itemData,
                type: 'eureka_response',
                query: item.completeData?.query || '',
                content: item.completeData?.content || '',
                metadata: item.completeData?.metadata || {},
                papers: item.completeData?.papers || [],
                timestamp: item.completeData?.timestamp || item.addedAt,
                ...(item.completeData && { completeData: item.completeData })
              };
              staffPosts.push(eurekaResponseData);
              break;
            case 'staff_post':
            case 'mongodb_paper':
              // Fetch user information for staff posts
              let userInfo = null;
              let userFullName = '';
              
              try {
                const { getUsersCollection } = await import("../../../../lib/mongodb-user-interactions");
                const usersCollection = await getUsersCollection();
                const userId = item.completeData?.userId || category.userId;
                
                if (userId) {
                  userInfo = await usersCollection.findOne({ id: userId });
                  userFullName = userInfo?.firstName && userInfo?.lastName 
                    ? `${userInfo.firstName} ${userInfo.lastName}`.trim() 
                    : userInfo?.firstName || userInfo?.lastName || userId;
                }
              } catch (userError) {
                console.error(" Error fetching user data for staff post:", userError);
                userFullName = item.completeData?.userId || category.userId || 'Unknown User';
              }
              
              const staffPostData = {
                ...itemData,
                // Add user information to the main object
                user: userInfo || { id: item.completeData?.userId || category.userId },
                userFullName: userFullName,
                staffPost: item.completeData ? {
                  id: generateNumericId(item.targetId), // Generate numeric ID for forum routing
                  targetId: item.targetId, // Add original targetId for unbookmarking
                  userId: item.completeData.userId || category.userId, // Use the actual userId from completeData
                  title: item.completeData.title,
                  abstract: item.completeData.abstract,
                  authors: item.completeData.authors || [],
                  subfields: item.completeData.subfields || [],
                  citedByCount: item.completeData.cited_by_count || item.completeData.citedByCount || 0,
                  publicationDate: item.completeData.publication_date || item.completeData.publicationDate,
                  doi: item.completeData.doi || '',
                  linkId: item.completeData.linkId || item.completeData.id || item.targetId,
                  citation: formatCitation(item.completeData),
                  relevanceScore: item.completeData.relevance_score || item.completeData.relevanceScore || 0,
                  journal: item.completeData.journal || '',
                  createdAt: item.completeData.createdAt || item.addedAt,
                  completePaperData: item.completeData,
                  // Add display fields for consistency with saved content API
                  displayTitle: item.completeData.title || 'Untitled Post',
                  displayAbstract: item.completeData.abstract || item.completeData.content || 'No content available',
                  displayAuthors: item.completeData.authors?.join(', ') || 'Unknown Authors',
                  displayJournal: item.completeData.journal || 'Staff Post',
                  displayDate: item.completeData.publication_date ? new Date(item.completeData.publication_date).toLocaleDateString() : 'Unknown Date'
                } : {
                  // Fallback structure when complete data is not available
                  id: generateNumericId(item.targetId),
                  targetId: item.targetId,
                  userId: category.userId,
                  title: 'Staff Post',
                  abstract: 'Content not available',
                  authors: [],
                  subfields: [],
                  citedByCount: 0,
                  publicationDate: item.addedAt,
                  doi: '',
                  linkId: item.targetId,
                  citation: '',
                  relevanceScore: 0,
                  journal: '',
                  createdAt: item.addedAt,
                  completePaperData: null,
                  displayTitle: 'Staff Post',
                  displayAbstract: 'Content not available',
                  displayAuthors: 'Unknown Authors',
                  displayJournal: 'Staff Post',
                  displayDate: 'Unknown Date'
                },
                ...(item.completeData && { ...item.completeData })
              };
              
              console.log(" Final staff post data:", {
                targetId: item.targetId,
                hasStaffPost: !!staffPostData.staffPost,
                staffPostTitle: staffPostData.staffPost?.title,
                staffPostAbstract: staffPostData.staffPost?.abstract?.substring(0, 50) + '...',
                linkId: staffPostData.staffPost?.linkId,
                hasLinkId: !!staffPostData.staffPost?.linkId,
                completeDataKeys: item.completeData ? Object.keys(item.completeData) : null
              });
              
              staffPosts.push(staffPostData);
              break;
            case 'grant':
              grants.push({
                ...itemData,
                grantId: item.targetId,
                grant: item.completeData || { id: item.targetId },
                ...(item.completeData && { ...item.completeData })
              });
              break;
          }
        }
      }

      return {
        ...category,
        id: category._id.toString(),
        _id: undefined, // Remove _id to avoid confusion
        posts,
        staffPosts,
        grants,
        items: undefined // Remove items array to avoid confusion
      };
    }));

    return NextResponse.json({ categories: formattedCategories });

  } catch (error) {
    console.error("Error getting saved categories:", error);
    return NextResponse.json({ 
      error: "Failed to get saved categories" 
    }, { status: 500 });
  }
}

// POST: Create a new saved category
export async function POST(req: NextRequest) {
  try {
    const { userId, name } = await req.json();
    
    if (!userId || !name) {
      return NextResponse.json({ 
        error: "userId and name are required" 
      }, { status: 400 });
    }

    // Validate user exists
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Check if category with same name already exists for this user
    const existingCategory = await categoriesCollection.findOne({
      userId,
      name: name.trim()
    });

    if (existingCategory) {
      return NextResponse.json({ 
        error: "A category with this name already exists" 
      }, { status: 409 });
    }

    // Create new category
    const newCategory = {
      userId,
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [] // Array to store bookmarked items
    };

    const result = await categoriesCollection.insertOne(newCategory);
    
    return NextResponse.json({ 
      success: true, 
      category: { 
        ...newCategory, 
        id: result.insertedId.toString(),
        _id: undefined, // Remove _id to avoid confusion
        posts: [],
        staffPosts: [],
        grants: [],
        items: undefined // Remove items array to avoid confusion
      }
    });

  } catch (error) {
    console.error("Error creating saved category:", error);
    return NextResponse.json({ 
      error: "Failed to create saved category" 
    }, { status: 500 });
  }
}

// PUT: Add item to saved category
export async function PUT(req: NextRequest) {
  try {
    const { categoryId, targetId, targetType, completeData, postId } = await req.json();
    
    if (!categoryId || !targetId || !targetType) {
      return NextResponse.json({ 
        error: "categoryId, targetId, and targetType are required" 
      }, { status: 400 });
    }

    console.log(" Adding item to category:", {
      categoryId,
      targetId,
      targetType,
      hasCompleteData: !!completeData,
      completeDataKeys: completeData ? Object.keys(completeData) : null
    });

    // Fetch complete data from bookmarks if not provided or incomplete
    let finalCompleteData = completeData;
    let finalPostId = postId;
    
    if (!completeData || !completeData.title) {
      try {
        console.log(" Fetching complete data from bookmarks...");
        const { getBookmarksCollection, getRepostsCollection } = await import("../../../../lib/mongodb-user-interactions");
        const bookmarksCollection = await getBookmarksCollection();
        const repostsCollection = await getRepostsCollection();
        
        let bookmark;
        
        // For reposts, we need to find the repost data using the postId
        if (targetType === 'repost' && (postId || finalPostId)) {
          const lookupPostId = postId || finalPostId;
          console.log(" Looking for repost data with postId:", lookupPostId);
          
          // Query the reposts collection directly using the postId
          const repostData = await repostsCollection.findOne({ postId: lookupPostId });
          
                      console.log(" Repost lookup result:", {
              lookupPostId: lookupPostId,
              postId: postId,
              finalPostId: finalPostId,
              targetId: targetId,
              foundRepost: !!repostData,
              repostId: repostData?._id,
              repostPostId: repostData?.postId
            });
          
          if (repostData) {
            console.log(" Found repost data:", {
              repostId: repostData._id,
              userId: repostData.userId,
              content: repostData.content,
              staffPostId: repostData.staffPostId,
              hasStaffPost: !!repostData.staffPost,
              repostKeys: Object.keys(repostData)
            });
            
            // Use the actual repost data structure as the complete data
            finalCompleteData = {
              id: repostData.id || repostData._id?.toString(),
              userId: repostData.userId,
              staffPostId: repostData.staffPostId,
              content: repostData.content,
              postId: repostData.postId,
              createdAt: repostData.createdAt,
              updatedAt: repostData.updatedAt,
              staffPost: repostData.staffPost,
              type: 'repost'
            };
            
            finalPostId = repostData.postId || lookupPostId;
            
            console.log(" Created complete data from repost:", {
              hasContent: !!finalCompleteData.content,
              hasStaffPost: !!finalCompleteData.staffPost,
              staffPostTitle: finalCompleteData.staffPost?.title,
              repostStructure: Object.keys(finalCompleteData)
            });
          } else {
            console.log(" No repost data found for postId:", postId);
            // Debug: Show sample reposts
            const allReposts = await repostsCollection.find({}).limit(3).toArray();
            console.log(" Sample reposts:", allReposts.map((r: any) => ({
              _id: r._id,
              postId: r.postId,
              userId: r.userId,
              content: r.content?.substring(0, 30)
            })));
          }
        } else if (targetType === 'grant') {
          // For grants, try to fetch from grants collection
          console.log(" Looking for grant data with targetId:", targetId);
          const { getGrantsCollection } = await import("../../../../lib/mongodb");
          const grantsCollection = await getGrantsCollection();
          
          let grant;
          try {
            // Try to find by ObjectId first
            const { ObjectId } = require('mongodb');
            grant = await grantsCollection.findOne({ _id: new ObjectId(targetId) });
          } catch (e) {
            // If ObjectId conversion fails, try as string
            grant = await grantsCollection.findOne({ _id: targetId });
          }
          
          if (grant) {
            console.log(" Found grant data:", {
              grantId: grant._id,
              title: grant.title,
              agency: grant.agency,
              type: grant.type
            });
            
            finalCompleteData = {
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
          } else {
            console.log(" No grant data found for targetId:", targetId);
          }
        } else {
          // For other types, use the standard lookup
          console.log(" Looking for bookmark with targetId:", targetId, "targetType:", targetType);
          bookmark = await bookmarksCollection.findOne({
            targetId: targetId.toString(),
            targetType: targetType
          });
          
          console.log(" Bookmark lookup result:", {
            targetId: targetId,
            targetType: targetType,
            foundBookmark: !!bookmark,
            hasTargetData: !!bookmark?.targetData,
            targetDataKeys: bookmark?.targetData ? Object.keys(bookmark.targetData) : null
          });
        }
        
        if (bookmark && bookmark.targetData) {
          finalCompleteData = bookmark.targetData;
          // For reposts, also get the postId from the bookmark data
          if (targetType === 'repost') {
            // Use the postId from the bookmark document itself
            finalPostId = bookmark.postId || bookmark.targetData.completePaperData?.postId;
            console.log(" Using postId from bookmark:", {
              bookmarkPostId: bookmark.postId,
              targetDataPostId: bookmark.targetData.completePaperData?.postId,
              finalPostId: finalPostId
            });
          }
          console.log(" Found complete data in bookmarks:", {
            hasTitle: !!bookmark.targetData.title,
            hasAbstract: !!bookmark.targetData.abstract,
            hasAuthors: !!bookmark.targetData.authors,
            targetDataKeys: Object.keys(bookmark.targetData),
            postId: finalPostId
          });
        } else {
          console.log(" No bookmark found or no targetData");
        }
      } catch (error) {
        console.log(" Could not fetch complete data from bookmarks:", error);
      }
    }

    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Validate target type
    const validTargetTypes = ['staff_post', 'mongodb_paper', 'grant', 'repost', 'post', 'eureka_response', 'eureka_result'];
    if (!validTargetTypes.includes(targetType)) {
      return NextResponse.json({ 
        error: "Invalid targetType. Must be one of: " + validTargetTypes.join(', ') 
      }, { status: 400 });
    }
    
    // Check if category exists
    const category = await categoriesCollection.findOne({ _id: new ObjectId(categoryId) });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check if item is already in the category
    const existingItem = category.items?.find((item: any) => 
      item.targetId === targetId && item.targetType === targetType
    );

    if (existingItem) {
      return NextResponse.json({ 
        error: "Item is already in this category" 
      }, { status: 409 });
    }
    
    // Add item to category with complete data
    const newItem = {
      targetId: targetId, // Keep the original targetId for consistency
      targetType: targetType === 'repost' ? 'repost' : targetType,
      addedAt: new Date(),
      completeData: finalCompleteData || null, // Store complete data if provided
      postId: finalPostId || null // Store postId for reposts
    };

    const result = await categoriesCollection.updateOne(
      { _id: new ObjectId(categoryId) },
      { 
        $push: { items: newItem },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Automatically create bookmark when item is added to category
    try {
      console.log(" Auto-creating bookmark for item added to category...");
      const { getBookmarksCollection } = await import("../../../../lib/mongodb-user-interactions");
      const bookmarksCollection = await getBookmarksCollection();
      
      // Check if bookmark already exists
      const existingBookmark = await bookmarksCollection.findOne({
        userId: category.userId,
        targetId: targetId,
        targetType: targetType
      });

      if (!existingBookmark) {
        // Create new bookmark
        const newBookmark = {
          userId: category.userId,
          targetId: targetId,
          targetType: targetType,
          generatedNumericId: generateNumericId(targetId),
          targetData: finalCompleteData || null,
          postId: finalPostId || null,
          createdAt: new Date()
        };

        await bookmarksCollection.insertOne(newBookmark);
        console.log(" Auto-created bookmark for item added to category");
      } else {
        console.log(" Bookmark already exists, skipping creation");
      }
    } catch (bookmarkError) {
      console.log(" Failed to auto-create bookmark:", bookmarkError);
      // Don't fail the entire operation if bookmark creation fails
    }

    return NextResponse.json({ 
      success: true, 
      item: newItem 
    });

  } catch (error) {
    console.error("Error adding item to category:", error);
    return NextResponse.json({ 
      error: "Failed to add item to category" 
    }, { status: 500 });
  }
}

// DELETE: Remove item from a category
export async function DELETE(req: NextRequest) {
  try {
    let categoryId, targetId, targetType;
    
    // Try to get data from request body first
    try {
      const body = await req.json();
      categoryId = body.categoryId;
      targetId = body.targetId;
      targetType = body.targetType;
    } catch (parseError) {
      // If JSON parsing fails, try query parameters
      const { searchParams } = new URL(req.url);
      categoryId = searchParams.get('id'); // For category deletion
      targetId = searchParams.get('targetId');
      targetType = searchParams.get('targetType');
    }
    
    if (!categoryId) {
      return NextResponse.json({ 
        error: "categoryId is required" 
      }, { status: 400 });
    }

    const categoriesCollection = await getSavedCategoriesCollection();
    
    // If only categoryId is provided, delete the entire category
    if (!targetId && !targetType) {
      const result = await categoriesCollection.deleteOne({ 
        _id: new ObjectId(categoryId) 
      });
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
      
      return NextResponse.json({ success: true });
    }
    
    // Otherwise, remove specific item from category
    if (!targetId || !targetType) {
      return NextResponse.json({ 
        error: "targetId and targetType are required for item removal" 
      }, { status: 400 });
    }
    
    console.log(" Removing item from category:", {
      categoryId,
      targetId,
      targetType
    });
    
    // First, let's check what's actually in the category
    const category = await categoriesCollection.findOne({ _id: new ObjectId(categoryId) });
    console.log(" Current category items:", category?.items?.map((item: any) => ({
      targetId: item.targetId,
      targetIdType: typeof item.targetId,
      targetType: item.targetType,
      targetTypeType: typeof item.targetType,
      searchTargetId: targetId,
      searchTargetIdType: typeof targetId,
      searchTargetType: targetType,
      searchTargetTypeType: typeof targetType,
      targetIdMatches: item.targetId === targetId,
      targetTypeMatches: item.targetType === targetType,
      matches: item.targetId === targetId && item.targetType === targetType
    })));
    
    // Log the exact query we're about to execute
    console.log(" MongoDB query:", {
      filter: { _id: new ObjectId(categoryId) },
      update: { 
        $pull: { 
          items: { 
            targetId, 
            targetType 
          } 
        },
        $set: { updatedAt: new Date() }
      }
    });
    
    let result = await categoriesCollection.updateOne(
      { _id: new ObjectId(categoryId) },
      { 
        $pull: { 
          items: { 
            targetId, 
            targetType 
          } 
        },
        $set: { updatedAt: new Date() }
      }
    );
    
    console.log(" Remove operation result (first attempt):", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      success: result.matchedCount > 0
    });

    // If no items were modified, try alternative approaches
    if (result.modifiedCount === 0) {
      console.log(" No items modified, trying alternative approaches...");
      
      // Try with targetId as string
      result = await categoriesCollection.updateOne(
        { _id: new ObjectId(categoryId) },
        { 
          $pull: { 
            items: { 
              targetId: targetId.toString(), 
              targetType 
            } 
          },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log(" Remove operation result (string targetId):", {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        success: result.matchedCount > 0
      });
      
      // If still no success, try with just targetId match (ignore targetType)
      if (result.modifiedCount === 0) {
        result = await categoriesCollection.updateOne(
          { _id: new ObjectId(categoryId) },
          { 
            $pull: { 
              items: { 
                targetId 
              } 
            },
            $set: { updatedAt: new Date() }
          }
        );
        
        console.log(" Remove operation result (targetId only):", {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          success: result.matchedCount > 0
        });
      }
      
      // If still no success, try with different targetType variations
      if (result.modifiedCount === 0) {
        const alternativeTargetTypes = ['staffPost', 'post', 'staff_post'];
        for (const altTargetType of alternativeTargetTypes) {
          if (altTargetType !== targetType) {
            result = await categoriesCollection.updateOne(
              { _id: new ObjectId(categoryId) },
              { 
                $pull: { 
                  items: { 
                    targetId, 
                    targetType: altTargetType
                  } 
                },
                $set: { updatedAt: new Date() }
              }
            );
            
            console.log(` Remove operation result (${altTargetType}):`, {
              matchedCount: result.matchedCount,
              modifiedCount: result.modifiedCount,
              success: result.matchedCount > 0
            });
            
            if (result.modifiedCount > 0) {
              console.log(` Successfully removed with targetType: ${altTargetType}`);
              break;
            }
          }
        }
      }
    }

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error removing item from category:", error);
    return NextResponse.json({ 
      error: "Failed to remove item from category" 
    }, { status: 500 });
  }
} 