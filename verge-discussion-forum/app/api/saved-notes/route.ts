import { NextRequest, NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("MONGO_URI environment variable is not defined");
}
const client = new MongoClient(uri);

// GET /api/saved-notes?userId=...&type=...&contentId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const type = searchParams.get("type"); // "post", "staffPost", or "grant"
  const contentId = searchParams.get("contentId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    let note = null;

    if (type && contentId) {
      // Get specific note - handle both string and number contentId
      // For MongoDB papers (complex strings), use as-is; for regular posts, convert to number
      const processedContentId = typeof contentId === 'string' && contentId.includes(':') 
        ? contentId 
        : (typeof contentId === 'string' ? parseInt(contentId, 10) : Number(contentId));
      
      note = await notesCollection.findOne({
        userId,
        targetId: processedContentId.toString(),
        targetType: type,
      });
    } else {
      // Get all notes for user
      const notes = await notesCollection.find({ userId }).toArray();
      
      const postNotes = notes.filter(note => note.targetType === "post");
      const staffPostNotes = notes.filter(note => note.targetType === "staffPost");
      const grantNotes = notes.filter(note => note.targetType === "grant");

      return NextResponse.json({
        postNotes,
        staffPostNotes,
        grantNotes,
      });
    }

    return NextResponse.json({ note });
  } catch (e) {
    console.error("[GET /api/saved-notes] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
}

// POST /api/saved-notes { userId, type, contentId, content }
export async function POST(req: NextRequest) {
  const { userId, type, contentId, content } = await req.json();

  if (!userId || !type || !contentId || !content) {
    return NextResponse.json(
      { error: "Missing userId, type, contentId, or content" },
      { status: 400 }
    );
  }

  try {
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Handle both string and number contentId
    // For MongoDB papers (complex strings), use as-is; for regular posts, convert to number
    const processedContentId = typeof contentId === 'string' && contentId.includes(':') 
      ? contentId 
      : (typeof contentId === 'string' ? parseInt(contentId, 10) : Number(contentId));
    
    // Check if note already exists
    const existingNote = await notesCollection.findOne({
      userId,
      targetId: processedContentId.toString(),
      targetType: type,
    });
    
    if (existingNote) {
      // Update existing note
      const updatedNote = await notesCollection.findOneAndUpdate(
        {
          userId,
          targetId: processedContentId.toString(),
          targetType: type,
        },
        {
          $set: {
            content,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );
      
      return NextResponse.json({ 
        success: true, 
        note: updatedNote?.value || { userId, targetId: processedContentId.toString(), targetType: type, content }
      });
    } else {
      // Create new note
      const newNote = await notesCollection.insertOne({
        userId,
        targetId: processedContentId.toString(),
        targetType: type,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return NextResponse.json({ 
        success: true, 
        note: { _id: newNote.insertedId, userId, targetId: processedContentId.toString(), targetType: type, content }
      });
    }
  } catch (e) {
    console.error("[POST /api/saved-notes] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
}

// DELETE /api/saved-notes { userId, type, contentId }
export async function DELETE(req: NextRequest) {
  const { userId, type, contentId } = await req.json();

  if (!userId || !type || !contentId) {
    return NextResponse.json(
      { error: "Missing userId, type, or contentId" },
      { status: 400 }
    );
  }

  try {
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Handle both string and number contentId
    // For MongoDB papers (complex strings), use as-is; for regular posts, convert to number
    const processedContentId = typeof contentId === 'string' && contentId.includes(':') 
      ? contentId 
      : (typeof contentId === 'string' ? parseInt(contentId, 10) : Number(contentId));
    
    const result = await notesCollection.deleteOne({
      userId,
      targetId: processedContentId.toString(),
      targetType: type,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/saved-notes] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
} 