import { NextRequest, NextResponse } from "next/server";
import { 
  getConnectionRequestsCollection, 
  getConnectionsCollection 
} from "../../../../../lib/mongodb-user-interactions";

export async function POST(req: NextRequest) {
  const { fromUserId, toUserId, action } = await req.json();
  
  if (!fromUserId || !toUserId || !action) {
    return NextResponse.json({ error: "fromUserId, toUserId, and action required" }, { status: 400 });
  }
  
  if (!["ACCEPT", "DECLINE"].includes(action)) {
    return NextResponse.json({ error: "Action must be ACCEPT or DECLINE" }, { status: 400 });
  }
  
  try {
    const connectionRequestsCollection = await getConnectionRequestsCollection();
    const connectionsCollection = await getConnectionsCollection();
    
    // Find the pending request
    const request = await connectionRequestsCollection.findOne({
      fromUserId,
      toUserId,
      status: "PENDING"
    });
    
    if (!request) {
      return NextResponse.json({ error: "Connection request not found" }, { status: 404 });
    }
    
    if (action === "ACCEPT") {
      // Update request status to ACCEPTED
      await connectionRequestsCollection.updateOne(
        { _id: request._id },
        { 
          $set: { 
            status: "ACCEPTED",
            updatedAt: new Date()
          } 
        }
      );
      
      // Create mutual connections (both directions)
      const connection1 = {
        id: crypto.randomUUID(),
        userId: fromUserId,
        connectionId: toUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const connection2 = {
        id: crypto.randomUUID(),
        userId: toUserId,
        connectionId: fromUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await connectionsCollection.insertMany([connection1, connection2]);
      
      return NextResponse.json({ 
        request: { ...request, status: "ACCEPTED" },
        connections: [connection1, connection2]
      });
    } else {
      // Update request status to DECLINED
      await connectionRequestsCollection.updateOne(
        { _id: request._id },
        { 
          $set: { 
            status: "DECLINED",
            updatedAt: new Date()
          } 
        }
      );
      
      return NextResponse.json({ 
        request: { ...request, status: "DECLINED" }
      });
    }
  } catch (error) {
    console.error("Failed to respond to connection request:", error);
    return NextResponse.json({ error: "Failed to respond to connection request" }, { status: 500 });
  }
} 