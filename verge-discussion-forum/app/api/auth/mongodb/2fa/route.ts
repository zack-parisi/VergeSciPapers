import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const { email, code, remember } = await req.json();
  if (!email || !code) {
    return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
  }
  
  try {
    const usersCollection = await getUsersCollection();
    
    const user = await usersCollection.findOne({ email });
    if (!user || !user.twoFactorCode || !user.twoFactorCodeExpires) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    
    const now = new Date();
    if (
      user.twoFactorCode !== code ||
      user.twoFactorCodeExpires < now
    ) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    
    await usersCollection.updateOne(
      { id: user.id },
      {
        $set: {
          twoFactorCode: null,
          twoFactorCodeExpires: null,
          bypass2FA: remember ? true : user.bypass2FA,
          updatedAt: new Date()
        }
      }
    );
    
    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } });
    
  } catch (error) {
    console.error("2FA error:", error);
    return NextResponse.json({ error: "2FA verification failed" }, { status: 500 });
  }
} 