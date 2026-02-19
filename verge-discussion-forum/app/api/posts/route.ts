import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const post = await prisma.post.findUnique({ where: { id: Number(id) } });
    return NextResponse.json(post);
  }
  // Only return posts that are NOT referenced by a Repost
  const posts = await prisma.post.findMany({
    where: {
      repost: null,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const { userId, content } = await req.json();
  if (!userId || !content) {
    return NextResponse.json({ error: "Missing userId or content" }, { status: 400 });
  }
  const post = await prisma.post.create({
    data: { userId, content },
  });
  return NextResponse.json(post);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await prisma.post.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { id, content } = await req.json();
  if (!id || !content) {
    return NextResponse.json({ error: "Missing id or content" }, { status: 400 });
  }
  try {
    const post = await prisma.post.update({
      where: { id: Number(id) },
      data: { content },
    });
    return NextResponse.json(post);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
} 