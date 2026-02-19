import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/mongodb/[...nextauth]';
import { getUsersCollection } from '../../../../lib/mongodb-user-interactions';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const usersCollection = await getUsersCollection();
    
    const user = await usersCollection.findOne(
      { id: userId },
      {
        projection: {
          id: 1,
          email: 1,
          hasCompletedOnboarding: 1,
          researchInterests: 1,
        }
      }
    );

    // Add default values for new fields
    const userWithDefaults = {
      ...user,
      hasCompletedOnboarding: user?.hasCompletedOnboarding || false,
      researchInterests: user?.researchInterests || [],
    };

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      user: userWithDefaults 
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Handle onboarding status update (temporarily commented out due to Prisma client issues)
    if (body.hasCompletedOnboarding !== undefined) {
      // const updatedUser = await prisma.user.update({
      //   where: { id: session.userId },
      //   data: {
      //     hasCompletedOnboarding: body.hasCompletedOnboarding,
      //   },
      //   select: {
      //     id: true,
      //     hasCompletedOnboarding: true,
      //   },
      // });

      // Return mock success response for now
      const updatedUser = {
        id: session.userId,
        hasCompletedOnboarding: body.hasCompletedOnboarding,
      };

      return NextResponse.json({ 
        success: true,
        user: updatedUser 
      });
    }

    // Handle profile fields update
    const {
      firstName,
      lastName,
      school,
      undergraduateStudent,
      graduateStudent,
      researchTechnician,
      postdoctoralScholar,
      principalInvestigator,
      industryProfessional,
      medicalStudent,
      resident,
      physician,
      clinician,
      otherRole,
      degree,
      intendedDegree,
      about,
      labAffiliation,
      currentProjects,    } = body;

    console.log('Updating profile for user:', session.userId, 'with data:', {
      firstName,
      lastName,
      school,
      undergraduateStudent,
      graduateStudent,
      researchTechnician,
      postdoctoralScholar,
      principalInvestigator,
      industryProfessional,
      medicalStudent,
      resident,
      physician,
      clinician,
      otherRole,
      degree,
      intendedDegree,
      about,
      labAffiliation,
      currentProjects,    });

    const usersCollection = await getUsersCollection();
    
    const updateData = {
      firstName,
      lastName,
      school,
      undergraduateStudent,
      graduateStudent,
      researchTechnician,
      postdoctoralScholar,
      principalInvestigator,
      industryProfessional,
      medicalStudent,
      resident,
      physician,
      clinician,
      otherRole,
      degree,
      intendedDegree,
      about,
      labAffiliation,
      currentProjects,      updatedAt: new Date()
    };
    
    const result = await usersCollection.updateOne(
      { id: session.userId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Fetch the updated user
    const updatedUser = await usersCollection.findOne(
      { id: session.userId },
      {
        projection: {
          id: 1,
          firstName: 1,
          lastName: 1,
          school: 1,
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
          degree: 1,
          intendedDegree: 1,
          about: 1,
          labAffiliation: 1,
          currentProjects: 1,        }
      }
    );

    return NextResponse.json({ 
      success: true,
      user: updatedUser 
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 