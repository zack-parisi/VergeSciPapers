import { NextRequest, NextResponse } from "next/server";
import { 
  getConnectionsCollection, 
  getConnectionRequestsCollection, 
  getUsersCollection 
} from "../../../lib/mongodb-user-interactions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  
  try {
    const connectionsCollection = await getConnectionsCollection();
    const connectionRequestsCollection = await getConnectionRequestsCollection();
    const usersCollection = await getUsersCollection();
    
    // Get user's connections
    const connections = await connectionsCollection.find({
      userId: userId
    }).toArray();
    
    // Get connection requests (both incoming and outgoing)
    const incomingRequests = await connectionRequestsCollection.find({
      toUserId: userId,
      status: "PENDING"
    }).toArray();
    
    const outgoingRequests = await connectionRequestsCollection.find({
      fromUserId: userId,
      status: "PENDING"
    }).toArray();
    
    // Get connected users' details
    const connectedUserIds = connections.map((conn: any) => conn.connectionId);
    const connectedUsers = await usersCollection.find({
      id: { $in: connectedUserIds }
    }).toArray();
    
    // Get users who sent connection requests
    const incomingUserIds = incomingRequests.map((req: any) => req.fromUserId);
    const incomingUsers = await usersCollection.find({
      id: { $in: incomingUserIds }
    }).toArray();
    
    // Get users who received connection requests
    const outgoingUserIds = outgoingRequests.map((req: any) => req.toUserId);
    const outgoingUsers = await usersCollection.find({
      id: { $in: outgoingUserIds }
    }).toArray();
    
    // Transform connected users
    const transformedConnectedUsers = connectedUsers.map((user: any) => {
      const fullName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || "User";

      let role = "Student";
      if (user.principalInvestigator) role = "Principal Investigator";
      else if (user.postdoctoralScholar) role = "Postdoctoral Scholar";
      else if (user.researchTechnician) role = "Research Technician";
      else if (user.industryProfessional) role = "Industry Professional";
      else if (user.physician) role = "Physician";
      else if (user.clinician) role = "Clinician";
      else if (user.resident) role = "Resident";
      else if (user.medicalStudent) role = "Medical Student";
      else if (user.graduateStudent) role = "Graduate Student";
      else if (user.undergraduateStudent) role = "Undergraduate Student";
      else if (user.otherRole) role = user.otherRole;

      return {
        ...user,
        fullName,
        role,
        displayName: fullName,
        connectionStatus: "connected",
        connectionType: "connected"
      };
    });
    
    // Transform incoming request users
    const transformedIncomingUsers = incomingUsers.map((user: any) => {
      const fullName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || "User";

      let role = "Student";
      if (user.principalInvestigator) role = "Principal Investigator";
      else if (user.postdoctoralScholar) role = "Postdoctoral Scholar";
      else if (user.researchTechnician) role = "Research Technician";
      else if (user.industryProfessional) role = "Industry Professional";
      else if (user.physician) role = "Physician";
      else if (user.clinician) role = "Clinician";
      else if (user.resident) role = "Resident";
      else if (user.medicalStudent) role = "Medical Student";
      else if (user.graduateStudent) role = "Graduate Student";
      else if (user.undergraduateStudent) role = "Undergraduate Student";
      else if (user.otherRole) role = user.otherRole;

      return {
        ...user,
        fullName,
        role,
        displayName: fullName,
        connectionStatus: "received",
        connectionType: "incoming_request"
      };
    });
    
    // Transform outgoing request users
    const transformedOutgoingUsers = outgoingUsers.map((user: any) => {
      const fullName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || "User";

      let role = "Student";
      if (user.principalInvestigator) role = "Principal Investigator";
      else if (user.postdoctoralScholar) role = "Postdoctoral Scholar";
      else if (user.researchTechnician) role = "Research Technician";
      else if (user.industryProfessional) role = "Industry Professional";
      else if (user.physician) role = "Physician";
      else if (user.clinician) role = "Clinician";
      else if (user.resident) role = "Resident";
      else if (user.medicalStudent) role = "Medical Student";
      else if (user.graduateStudent) role = "Graduate Student";
      else if (user.undergraduateStudent) role = "Undergraduate Student";
      else if (user.otherRole) role = user.otherRole;

      return {
        ...user,
        fullName,
        role,
        displayName: fullName,
        connectionStatus: "pending",
        connectionType: "outgoing_request"
      };
    });
    
    return NextResponse.json({
      connections: transformedConnectedUsers,
      incomingRequests: transformedIncomingUsers,
      outgoingRequests: transformedOutgoingUsers,
      stats: {
        totalConnections: transformedConnectedUsers.length,
        totalIncomingRequests: transformedIncomingUsers.length,
        totalOutgoingRequests: transformedOutgoingUsers.length
      }
    });
  } catch (error) {
    console.error("Failed to fetch network data:", error);
    return NextResponse.json({ error: "Failed to fetch network data" }, { status: 500 });
  }
} 