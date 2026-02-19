import { NextRequest, NextResponse } from 'next/server';
import { getStaffPostsCollection, getPapersStaffPostsCollection, getBookmarksCollection } from '../../../../lib/mongodb-user-interactions';

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('postId');
  const contextSize = parseInt(searchParams.get('contextSize') || '0');

  console.log(' MongoDB Staff Posts API called with:', { postId, contextSize });

  try {
    if (postId) {
      // Fetch specific post by ID
      // Try user_data database first
      const staffPostsCollection = await getStaffPostsCollection();
      let post = await staffPostsCollection.findOne({ id: postId });

      // If not found in user_data, try papers database
      if (!post) {
        const papersStaffPostsCollection = await getPapersStaffPostsCollection();
        
        // Try to find by numeric ID first (in case there's a mapping)
        post = await papersStaffPostsCollection.findOne({ id: postId });
        
        // If not found by numeric ID, try to find by looking up the generated numeric ID in bookmarks
        if (!post) {
          console.log(` Looking for document with generated ID: ${postId}`);
          
          // Look in bookmarks to find the targetId that generates this numeric ID
          const bookmarksCollection = await getBookmarksCollection();
          const bookmark = await bookmarksCollection.findOne({ 
            generatedNumericId: parseInt(postId) 
          });
          
          if (bookmark) {
            console.log(` Found bookmark with generated ID ${postId}:`, bookmark.targetId);
            
            // Now fetch the actual document from papers_staff_posts using the targetId
            post = await papersStaffPostsCollection.findOne({ 
              work_id: bookmark.targetId 
            });
            
            if (post) {
              console.log(` Found document in papers_staff_posts:`, post.title);
            } else {
              console.log(` Document not found in papers_staff_posts for targetId:`, bookmark.targetId);
            }
          } else {
            console.log(` No bookmark found with generated ID: ${postId}`);
            
            // Fallback: try to find by work_id patterns (less efficient but might work)
            const possibleWorkIds = [
              `https://openalex.org/W${postId}`,
              `W${postId}`,
              postId.toString()
            ];
            
            for (const workId of possibleWorkIds) {
              post = await papersStaffPostsCollection.findOne({ work_id: workId });
              if (post) {
                console.log(` Found document with work_id: ${workId}`);
                break;
              }
            }
          }
        }
      }

      if (!post) {
        return NextResponse.json({ posts: [] });
      }

      // Transform the post to match the expected format
      const transformedPost = {
        ...post,
        // Use the original postId as the id for consistency
        id: postId,
        authors: post.authors || [],
        subfields: post.subfields || [],
        citation: post.citation || "",
      };

      return NextResponse.json({ posts: [transformedPost] });
    }

    // Fetch all posts (existing behavior)
    const staffPostsCollection = await getStaffPostsCollection();
    console.log(' Fetching all staff posts from MongoDB...');
    
    const posts = await staffPostsCollection.find({}).sort({ createdAt: -1 }).toArray();
    console.log(` Found ${posts.length} staff posts in MongoDB`);

    // Transform posts to match expected format
    const transformedPosts = posts.map((post: any) => ({
      ...post,
      authors: post.authors || [],
      subfields: post.subfields || [],
      citation: post.citation || "",
    }));

    console.log(' Returning transformed posts:', transformedPosts.length);
    return NextResponse.json({ posts: transformedPosts });
  } catch (error) {
    console.error(' Error fetching staff posts:', error);
    console.error(' Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return NextResponse.json({ error: 'Failed to fetch staff posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      title,
      authors,
      publicationDate,
      citedByCount,
      abstract,
      doi,
      linkId,
      citation,
      subfields
    } = await request.json();
    
    if (!userId || !title || !abstract) {
      return NextResponse.json(
        { error: "userId, title, and abstract are required" },
        { status: 400 }
      );
    }

    const staffPostsCollection = await getStaffPostsCollection();

    // Create the staff post
    const newPost = {
      id: crypto.randomUUID(),
      userId,
      title,
      publicationDate: publicationDate ? new Date(publicationDate) : new Date(),
      citedByCount: typeof citedByCount === 'number' ? citedByCount : 0,
      abstract,
      doi: doi || '',
      linkId: linkId || '',
      citation: citation || '',
      authors: Array.isArray(authors) ? authors : [],
      subfields: Array.isArray(subfields) ? subfields : [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await staffPostsCollection.insertOne(newPost);

    if (result.acknowledged) {
      const transformedPost = {
        ...newPost,
        authors: newPost.authors || [],
        subfields: newPost.subfields || [],
        citation: newPost.citation || '',
      };
      return NextResponse.json(transformedPost);
    } else {
      throw new Error("Failed to insert staff post");
    }
  } catch (error) {
    console.error('Error creating staff post:', error);
    return NextResponse.json({ error: 'Failed to create staff post' }, { status: 500 });
  }
} 