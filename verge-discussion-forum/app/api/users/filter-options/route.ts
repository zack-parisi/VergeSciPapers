import { NextRequest, NextResponse } from "next/server";
import { getTopicsCollection, getUsersCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const usersCollection = await getUsersCollection();
    
    // Get all users with completed profiles from MongoDB
    const usersWithProfiles = await usersCollection.find({
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
    }).toArray();

    // Extract unique schools
    const schools = Array.from(new Set(usersWithProfiles.map((user: any) => user.school).filter(Boolean))).sort();

    // Extract unique degrees (combine degree and intendedDegree)
    const degrees = Array.from(new Set(
      usersWithProfiles
        .map((user: any) => user.degree || user.intendedDegree)
        .filter(Boolean)
    )).sort();

    // Extract unique statuses/roles
    const statuses = new Set<string>();
    usersWithProfiles.forEach((user: any) => {
      if (user.principalInvestigator) statuses.add("Principal Investigator");
      if (user.postdoctoralScholar) statuses.add("Postdoctoral Scholar");
      if (user.researchTechnician) statuses.add("Research Technician");
      if (user.industryProfessional) statuses.add("Industry Professional");
      if (user.physician) statuses.add("Physician");
      if (user.clinician) statuses.add("Clinician");
      if (user.resident) statuses.add("Resident");
      if (user.medicalStudent) statuses.add("Medical Student");
      if (user.graduateStudent) statuses.add("Graduate Student");
      if (user.undergraduateStudent) statuses.add("Undergraduate Student");
      if (user.otherRole) statuses.add(user.otherRole);
    });

    // Get unique research interests from user documents
    const topicsCollection = await getTopicsCollection();
    
    // Get all unique topic names from user research interests
    const allTopicNames = usersWithProfiles.flatMap((user: any) => user.researchInterests || []);
    const uniqueTopicNames = Array.from(new Set(allTopicNames)) as string[];
    
    // Sort the topic names
    const interests = uniqueTopicNames.sort();

    return NextResponse.json({
      statusOptions: ["All", ...Array.from(statuses).sort()],
      schoolOptions: ["All", ...schools],
      degreeOptions: ["All", ...degrees],
      interestOptions: interests,
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return NextResponse.json(
      { error: "Failed to fetch filter options" },
      { status: 500 }
    );
  }
} 