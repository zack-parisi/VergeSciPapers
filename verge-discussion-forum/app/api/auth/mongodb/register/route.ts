import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "../../../../../lib/mongodb-user-interactions";
import bcrypt from "bcrypt";
import { Resend } from "resend";
import { appendSignupToSheet } from "../../../../utils/googleSheets";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// Helper function to check if email is from an educational institution
function isEducationalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'edu' || domain?.endsWith('.edu');
}

export async function POST(req: NextRequest) {
  const { email, password, firstName, lastName } = await req.json();
  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  
  console.log(' Starting registration for email:', email);
  
  try {
    const usersCollection = await getUsersCollection();
    console.log(' MongoDB connection successful');
    
    // Check if user exists
    const existing = await usersCollection.findOne({ email });
    if (existing) {
      console.log(' User already exists:', email);
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const canInteract = isEducationalEmail(email);
    
    // Generate user ID and verification token first
    const userId = crypto.randomUUID();
    const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64");
    
    console.log(' Generated userId:', userId);
    console.log(' Generated token:', token);
    
    // Create user in MongoDB with token already included
    const user = {
      id: userId,
      email,
      passwordHash,
      firstName,
      lastName,
      emailVerified: null, // Require email verification
      canInteract,
      school: null,
      education: null,
      degree: null,
      undergraduateStudent: null,
      graduateStudent: null,
      researchTechnician: null,
      postdoctoralScholar: null,
      principalInvestigator: null,
      industryProfessional: null,
      medicalStudent: null,
      resident: null,
      physician: null,
      clinician: null,
      otherRole: null,
      intendedDegree: null,
      about: null,
      verificationToken: token, // Store token directly during creation
      twoFactorEnabled: false,
      bypass2FA: false,
      twoFactorCode: null,
      twoFactorCodeExpires: null,
      hasCompletedOnboarding: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log(' Creating user with token included...');
    const result = await usersCollection.insertOne(user);
    console.log(' User created successfully:', result.insertedId);
    
    // Verify the token was actually stored
    const createdUser = await usersCollection.findOne({ id: userId });
    console.log(' Created user verificationToken:', createdUser?.verificationToken ? 'Token stored' : 'Token NOT stored');
    
    if (!createdUser?.verificationToken) {
      console.error(' CRITICAL: Verification token was not stored during creation!');
      // Try to update it as a fallback
      console.log(' Trying fallback update...');
      const fallbackUpdate = await usersCollection.updateOne(
        { id: userId },
        { $set: { verificationToken: token } }
      );
      console.log(' Fallback update result:', fallbackUpdate);
      
      // Check again
      const finalUser = await usersCollection.findOne({ id: userId });
      console.log(' Final user verificationToken:', finalUser?.verificationToken ? 'Token stored' : 'Token NOT stored');
    }

    // Send verification email using Resend
    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/verify?token=${encodeURIComponent(token)}`;
    
    console.log(" Attempting to send email with Resend...");
    console.log(" From email: noreply@vergesci.com");
    console.log(" To email:", email);
    console.log(" API Key exists:", !!process.env.RESEND_API_KEY);
    console.log(" Verify URL:", verifyUrl);
    
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const emailResult = await resend.emails.send({
        from: "noreply@vergesci.com",
        to: email,
        subject: "Verify your VergeSci account",
        html: `
          <h2>Welcome to VergeSci!</h2>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verifyUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
            Verify Email
          </a>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${verifyUrl}</p>
        `
      });
      console.log(" Email sent successfully:", emailResult);
    } catch (emailError) {
      console.error(" Failed to send email:", emailError);
      // Don't fail registration if email fails
    }

    // Submit signup data to Google Sheets (non-blocking)
    try {
      await appendSignupToSheet({
        firstName,
        lastName,
        email,
        timestamp: new Date().toISOString(),
      });
      console.log(" Signup data sent to Google Sheets");
    } catch (sheetsError) {
      console.error(" Failed to send signup data to Google Sheets:", sheetsError);
      // Don't fail registration if Google Sheets fails
    }
    
    console.log(' Registration completed successfully');
    return NextResponse.json({ 
      success: true, 
      user: { id: userId, email: user.email }, 
      token 
    });
    
  } catch (error: any) {
    console.error(" Registration error:", error);
    console.error(" Error details:", {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'Unknown error type'
    });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
