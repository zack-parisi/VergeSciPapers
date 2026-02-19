import { NextRequest, NextResponse } from "next/server";
import { getConnectionRequestsCollection, getUsersCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromUserId = searchParams.get("fromUserId");
  const toUserId = searchParams.get("toUserId");
  
  if (!fromUserId && !toUserId) {
    return NextResponse.json({ error: "Either fromUserId or toUserId required" }, { status: 400 });
  }
  
  try {
    const connectionRequestsCollection = await getConnectionRequestsCollection();
    const usersCollection = await getUsersCollection();
    
    let query: any = { status: "PENDING" };
    if (fromUserId) {
      query.fromUserId = fromUserId;
    }
    if (toUserId) {
      query.toUserId = toUserId;
    }
    
    const requests = await connectionRequestsCollection.find(query).toArray();
    
    // Get user details for the requests
    const userIds = requests.map((req: any) => 
      fromUserId ? req.toUserId : req.fromUserId
    );
    
    const users = await usersCollection.find({
      id: { $in: userIds }
    }).toArray();
    
    // Create a map of user details
    const userMap = new Map();
    users.forEach((user: any) => {
      userMap.set(user.id, user);
    });
    
    // Add user details to requests
    const requestsWithUsers = requests.map((req: any) => {
      const userId = fromUserId ? req.toUserId : req.fromUserId;
      const user = userMap.get(userId);
      return {
        ...req,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.firstName || user.lastName || "User",
          school: user.school,
          role: user.undergraduateStudent ? "Undergraduate Student" :
                user.graduateStudent ? "Graduate Student" :
                user.researchTechnician ? "Research Technician" :
                user.postdoctoralScholar ? "Postdoctoral Scholar" :
                user.principalInvestigator ? "Principal Investigator" :
                user.industryProfessional ? "Industry Professional" :
                user.physician ? "Physician" :
                user.clinician ? "Clinician" :
                user.resident ? "Resident" :
                user.medicalStudent ? "Medical Student" :
                user.otherRole || "Student"
        } : null
      };
    });
    
    return NextResponse.json({ requests: requestsWithUsers });
  } catch (error) {
    console.error("Failed to fetch connection requests:", error);
    return NextResponse.json({ error: "Failed to fetch connection requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { fromUserId, toUserId } = await req.json();
  
  if (!fromUserId || !toUserId) {
    return NextResponse.json({ error: "fromUserId and toUserId required" }, { status: 400 });
  }
  
  if (fromUserId === toUserId) {
    return NextResponse.json({ error: "Cannot send request to yourself" }, { status: 400 });
  }
  
  try {
    const connectionRequestsCollection = await getConnectionRequestsCollection();
    
    // Check if request already exists
    const existingRequest = await connectionRequestsCollection.findOne({
      fromUserId,
      toUserId,
      status: "PENDING"
    });
    
    if (existingRequest) {
      return NextResponse.json({ error: "Connection request already sent" }, { status: 409 });
    }
    
    const request = {
      id: crypto.randomUUID(),
      fromUserId,
      toUserId,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await connectionRequestsCollection.insertOne(request);
    
    return NextResponse.json({ 
      request: { ...request, _id: result.insertedId }
    });
  } catch (error) {
    console.error("Failed to create connection request:", error);
    return NextResponse.json({ error: "Failed to create connection request" }, { status: 500 });
  }
} 