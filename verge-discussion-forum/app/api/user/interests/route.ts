import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/mongodb/[...nextauth]';
import { getTopicsV2Collection, getUsersCollection } from '../../../../lib/mongodb-user-interactions';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

/**
 * GET /api/user/interests
 * Fetch the current user's research interests
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get MongoDB collections
    const topicsV2Collection = await getTopicsV2Collection();
    const usersCollection = await getUsersCollection();
    
    console.log('Fetching interests for user:', session.userId);
    
    // Get user document with research interests
    const user = await usersCollection.findOne({ id: session.userId });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const selectedTopicNames = user.researchInterests || [];
    
    if (selectedTopicNames.length === 0) {
      return NextResponse.json({ 
        success: true,
        interests: []
      });
    }
    
    // For topics_v2, we store topic names directly, so we can return them as-is
    // But we need to create the same format as before for compatibility
    const interests = selectedTopicNames.map((topicName: string, index: number) => ({
      id: index + 1, // Use index-based ID for compatibility
      name: topicName,
    }));

    return NextResponse.json({ 
      success: true,
      interests: interests
    });
  } catch (error) {
    console.error('Error fetching user interests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user interests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/interests
 * Update the current user's research interests
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('POST /api/user/interests - Session:', session);
    console.log('POST /api/user/interests - Session userId:', session?.userId);
    
    if (!session?.userId) {
      console.log('POST /api/user/interests - No session or userId, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { subfieldIds } = await req.json();

    if (!Array.isArray(subfieldIds)) {
      return NextResponse.json(
        { error: 'subfieldIds must be an array' },
        { status: 400 }
      );
    }

    // Get MongoDB collections
    const topicsV2Collection = await getTopicsV2Collection();
    const usersCollection = await getUsersCollection();
    
    console.log('Saving interests for user:', session.userId, 'subfieldIds:', subfieldIds);

    // For topics_v2, subfieldIds now contains topic names (strings) instead of ObjectIds
    // We need to validate that these topic names exist in topics_v2
    const topicsV2Doc = await topicsV2Collection.findOne({ _id: 'topics_v2_root' });
    const availableTopicNames = topicsV2Doc?.topic_names || [];
    
    // Filter to only include valid topic names
    const validTopicNames = subfieldIds.filter((topicName: string) => 
      availableTopicNames.includes(topicName)
    );
    
    console.log('Valid topic names:', validTopicNames);

    // Update user document with research interests (topic names)
    const result = await usersCollection.updateOne(
      { id: session.userId },
      { 
        $set: { 
          researchInterests: validTopicNames,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return the saved interests in the expected format
    const interests = validTopicNames.map((topicName: string, index: number) => ({
      id: index + 1, // Use index-based ID for compatibility
      name: topicName,
    }));

    return NextResponse.json({ 
      success: true,
      interests: interests
    });
  } catch (error) {
    console.error('Error updating user interests:', error);
    return NextResponse.json(
      { error: 'Failed to update user interests' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/interests
 * Remove a specific research interest from the current user
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { subfieldId } = await req.json();

    if (!subfieldId) {
      return NextResponse.json(
        { error: 'subfieldId is required' },
        { status: 400 }
      );
    }

    // Get MongoDB collections
    const usersCollection = await getUsersCollection();
    
    console.log('Removing interest for user:', session.userId, 'subfieldId:', subfieldId);

    // For topics_v2, subfieldId is now a topic name (string) instead of ObjectId
    // Remove the topic name from user's research interests
    const result = await usersCollection.updateOne(
      { id: session.userId },
      { 
        $pull: { 
          researchInterests: subfieldId
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch the updated user interests
    const updatedUser = await usersCollection.findOne({ id: session.userId });
    const selectedTopicNames = updatedUser?.researchInterests || [];
    
    // Return the updated interests in the expected format
    const interests = selectedTopicNames.map((topicName: string, index: number) => ({
      id: index + 1, // Use index-based ID for compatibility
      name: topicName,
    }));

    return NextResponse.json({ 
      success: true,
      interests: interests
    });
  } catch (error) {
    console.error('Error removing user interest:', error);
    return NextResponse.json(
      { error: 'Failed to remove user interest' },
      { status: 500 }
    );
  }
}
