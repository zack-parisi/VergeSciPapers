import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// Helper function to validate and decode token
function validateToken(token: string): { userId: string; timestamp: number } | null {
  try {
    // Decode the base64 token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    console.log(' Decoded token:', decoded);
    
    // Split by colon to get userId and timestamp
    const parts = decoded.split(':');
    if (parts.length !== 2) {
      console.log(' Invalid token format - wrong number of parts');
      return null;
    }
    
    const [userId, timestampStr] = parts;
    const timestamp = parseInt(timestampStr, 10);
    
    if (!userId || isNaN(timestamp)) {
      console.log(' Invalid token format - invalid userId or timestamp');
      return null;
    }
    
    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (tokenAge > maxAge) {
      console.log(' Token expired - age:', tokenAge, 'max age:', maxAge);
      return null;
    }
    
    console.log(' Token validation successful - userId:', userId, 'age:', tokenAge);
    return { userId, timestamp };
  } catch (error) {
    console.log(' Token validation error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  
  console.log(' Verification attempt with token:', token);
  console.log(' Environment check - NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
  console.log(' Environment check - MONGO_URI exists:', !!process.env.MONGO_URI);
  console.log(' Environment check - NODE_ENV:', process.env.NODE_ENV);
  
  // Validate token format and expiration
  const tokenData = validateToken(token);
  if (!tokenData) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }
  
  try {
    const usersCollection = await getUsersCollection();
    console.log(' MongoDB connection successful');
    
    // Try multiple search strategies to find the user
    let user = null;
    let searchMethod = '';
    
    // Strategy 1: Search by verificationToken field
    console.log(' Strategy 1: Searching by verificationToken field');
    user = await usersCollection.findOne({ verificationToken: token });
    if (user) {
      searchMethod = 'verificationToken field';
      console.log(' User found via verificationToken field');
    }
    
    // Strategy 2: Search by userId from token
    if (!user) {
      console.log(' Strategy 2: Searching by userId from token');
      user = await usersCollection.findOne({ id: tokenData.userId });
      if (user) {
        searchMethod = 'userId from token';
        console.log(' User found via userId, checking if already verified');
        
        // Check if user is already verified
        if (user.emailVerified) {
          console.log(' User is already verified');
          return NextResponse.json({ success: true, message: "Email already verified" });
        }
      }
    }
    
    // Strategy 3: Search by email if we can decode it from the token
    if (!user) {
      console.log(' Strategy 3: Searching by email (if available)');
      // This is a fallback - we don't have email in token, but could be useful for debugging
      console.log(' No email in token for fallback search');
    }
    
    // Debug: Check all users with verification tokens
    const allUsersWithTokens = await usersCollection.find({ verificationToken: { $ne: null } }).toArray();
    console.log(' All users with verification tokens:', allUsersWithTokens.map((u: any) => ({ id: u.id, token: u.verificationToken })));
    
    if (!user) {
      console.log(' No user found with any search strategy');
      console.log(' Token length:', token.length);
      console.log(' Token first 20 chars:', token.substring(0, 20));
      console.log(' Expected userId from token:', tokenData.userId);
      
      // Additional debugging: show all users
      const allUsers = await usersCollection.find({}).toArray();
      console.log(' All users in database:', allUsers.map((u: any) => ({ id: u.id, email: u.email, emailVerified: u.emailVerified })));
      
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    
    console.log(' User found via method:', searchMethod);
    console.log(' User details:', { id: user.id, email: user.email, emailVerified: user.emailVerified });
    
    // Mark email as verified and clear token
    const updateResult = await usersCollection.updateOne(
      { id: user.id },
      { 
        $set: { 
          emailVerified: new Date(), 
          verificationToken: null,
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(' Verification update result:', updateResult);
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error(" Verification error:", error);
    console.error(" Error details:", {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'Unknown error type'
    });
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
} 