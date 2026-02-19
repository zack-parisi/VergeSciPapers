import { NextRequest, NextResponse } from "next/server";
import { getTopicsCollection, getUserInterestsCollection, getUsersCollection, getConnectionsCollection, getConnectionRequestsCollection } from "../../../lib/mongodb-user-interactions";
import { ObjectId } from "mongodb";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "100");
  const currentUserId = searchParams.get("currentUserId");
  const skip = (page - 1) * limit;

  try {
    const usersCollection = await getUsersCollection();
    
    // Build MongoDB query for users with completed profiles
    const query: any = {
      firstName: { $ne: null },
      lastName: { $ne: null },
      $or: [
        { undergraduateStudent: true },
        { graduateStudent: true },
        { researchTechnician: true },
        { postdoctoralScholar: true },
        { principalInvestigator: true },
        { industryProfessional: true },
        { medicalStudent: true },
        { resident: true },
        { physician: true },
        { clinician: true },
        { otherRole: { $ne: null } },
      ],
    };

    // Exclude current user if provided
    if (currentUserId) {
      query.id = { $ne: currentUserId };
    }

    // Get total count for pagination
    const totalCount = await usersCollection.countDocuments(query);

    // Get users with completed profiles
    const usersWithProfiles = await usersCollection.find(query)
      .sort({ id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Transform users to include full name, role, research interests, and connection status
    const transformedUsers = await Promise.all(usersWithProfiles.map(async (user: any) => {
      const fullName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || "User";

      // Determine role based on boolean fields
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

      // Fetch research interests from user document
      const topicsCollection = await getTopicsCollection();
      const selectedTopicNames = user.researchInterests || [];
      
      let researchInterests = [];
      if (selectedTopicNames.length > 0) {
        const topics = await topicsCollection.find({
          topic_name: { $in: selectedTopicNames }
        }).toArray();
        
        researchInterests = topics.map((topic: any) => ({
          subfield: {
            id: topic._id.toString(),
            name: topic.topic_name,
          },
        }));
      }

      // Check connection status with current user
      let connectionStatus = "none";
      if (currentUserId) {
        const connectionsCollection = await getConnectionsCollection();
        const connectionRequestsCollection = await getConnectionRequestsCollection();
        
        // Check if they are already connected
        const existingConnection = await connectionsCollection.findOne({
          $or: [
            { userId: currentUserId, connectionId: user.id },
            { userId: user.id, connectionId: currentUserId }
          ]
        });
        
        if (existingConnection) {
          connectionStatus = "connected";
        } else {
          // Check for pending requests
          const pendingRequest = await connectionRequestsCollection.findOne({
            $or: [
              { fromUserId: currentUserId, toUserId: user.id, status: "PENDING" },
              { fromUserId: user.id, toUserId: currentUserId, status: "PENDING" }
            ]
          });
          
          if (pendingRequest) {
            connectionStatus = pendingRequest.fromUserId === currentUserId ? "pending" : "received";
          }
        }
      }

      return {
        ...user,
        fullName,
        role,
        displayName: fullName,
        researchInterests,
        connectionStatus,
      };
    }));

    return NextResponse.json({
      users: transformedUsers,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
} 