import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if email is already verified
  if (user.emailVerified) {
    return NextResponse.json({ error: "Email is already verified" }, { status: 400 });
  }

  // Generate new verification token
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");
  await prisma.user.update({ where: { id: user.id }, data: { about: token } });

  // Send verification email
  const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/verify?token=${encodeURIComponent(token)}`;
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: "noreply@vergesci.com",
      to: email,
      subject: "VergeSci - Email Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Email Verification</h2>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>You requested a new verification email for your VergeSci account. Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email Address</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
          <p>This link will expire in 24 hours for security reasons.</p>
          <p>If you didn't request this email, you can safely ignore it.</p>
          <p>Best regards,<br>The VergeSci Team</p>
        </div>
      `,
    });
    
    console.log("Resend verification email sent successfully:", result);
    return NextResponse.json({ success: true, message: "Verification email sent" });
    
  } catch (e) {
    console.error("Failed to send resend verification email:", e);
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }
} 