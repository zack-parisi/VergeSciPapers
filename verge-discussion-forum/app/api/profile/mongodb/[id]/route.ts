import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  
  try {
    const usersCollection = await getUsersCollection();
    
    const user = await usersCollection.findOne(
      { id },
      {
        projection: {
          id: 1,
          firstName: 1,
          lastName: 1,
          education: 1,
          degree: 1,
          undergraduateStudent: 1,
          graduateStudent: 1,
          researchTechnician: 1,
          postdoctoralScholar: 1,
          principalInvestigator: 1,
          industryProfessional: 1,
          medicalStudent: 1,
          resident: 1,
          physician: 1,
          clinician: 1,
          otherRole: 1,
          intendedDegree: 1,
          about: 1,
          labAffiliation: 1,
          currentProjects: 1,          school: 1,
        }
      }
    );
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (e) {
    console.error("Profile fetch error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }
  
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  
  try {
    const usersCollection = await getUsersCollection();
    
    const user = await usersCollection.findOne({ id });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const updateData = {
      firstName: data.firstName,
      lastName: data.lastName,
      education: data.education,
      degree: data.degree,
      undergraduateStudent: data.undergraduateStudent,
      graduateStudent: data.graduateStudent,
      researchTechnician: data.researchTechnician,
      postdoctoralScholar: data.postdoctoralScholar,
      principalInvestigator: data.principalInvestigator,
      industryProfessional: data.industryProfessional,
      medicalStudent: data.medicalStudent,
      resident: data.resident,
      physician: data.physician,
      clinician: data.clinician,
      otherRole: data.otherRole,
      intendedDegree: data.intendedDegree,
      about: data.about,
      labAffiliation: data.labAffiliation,
      currentProjects: data.currentProjects,      school: data.school,
      updatedAt: new Date()
    };
    
    const result = await usersCollection.updateOne(
      { id },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Fetch the updated user
    const updatedUser = await usersCollection.findOne({ id });
    
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (e) {
    console.error("Profile update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 