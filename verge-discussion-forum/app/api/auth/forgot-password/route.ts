import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import crypto from "crypto";

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal if user exists or not for security
    return NextResponse.json({ success: true, message: "If an account with that email exists, a password reset link has been sent." });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store reset token in database (using the 'about' field temporarily)
  await prisma.user.update({
    where: { id: user.id },
    data: { about: resetToken }
  });

  // Send password reset email
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(resetToken)}`;
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "team@vergesci.com",
      to: email,
      subject: "Reset your VergeSci password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Reset Your Password</h2>
          <p>Hi ${user.firstName || 'there'},</p>
          <p>We received a request to reset your password for your VergeSci account. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 24 hours for security reasons.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <p>Best regards,<br>The VergeSci Team</p>
        </div>
      `,
    });

    return NextResponse.json({ 
      success: true, 
      message: "If an account with that email exists, a password reset link has been sent." 
    });

  } catch (e) {
    console.error("Failed to send password reset email:", e);
    return NextResponse.json({ error: "Failed to send password reset email" }, { status: 500 });
  }
} 