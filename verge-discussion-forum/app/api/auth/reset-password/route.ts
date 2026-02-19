import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  
  if (!token || !password) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
  }

  try {
    // Find user by reset token (stored in 'about' field)
    const user = await prisma.user.findFirst({ where: { about: token } });
    
    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user's password and clear the reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        about: null, // Clear the reset token
      },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });

  } catch (e) {
    console.error("Error resetting password:", e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
} 