import { NextRequest, NextResponse } from "next/server";
import { getConnectionsCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  
  try {
    const connectionsCollection = await getConnectionsCollection();
    
    const connections = await connectionsCollection.find({
      $or: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    }).toArray();
    
    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Failed to fetch connections:", error);
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }
} 