import { NextRequest, NextResponse } from "next/server";
import { getSavedCategoriesCollection } from "../../../../../lib/mongodb-user-interactions";
import { ObjectId } from "mongodb";
import { MongoClient } from "mongodb";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error("MONGO_URI environment variable is not defined");
}
const client = new MongoClient(uri);

// GET /api/saved-categories/[id]/note - Get note for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  
  try {
    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Get the category
    const category = await categoriesCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Connect to MongoDB for notes
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Get project note
    const projectNote = await notesCollection.findOne({
      userId,
      targetId: id,
      targetType: "project",
    });

    // Get individual notes for content in this project
    const individualNotes = await notesCollection.find({ userId }).toArray();
    
    const postNotes = individualNotes.filter(note => note.targetType === "post");
    const staffPostNotes = individualNotes.filter(note => note.targetType === "staffPost");
    const grantNotes = individualNotes.filter(note => note.targetType === "grant");

    return NextResponse.json({ 
      note: projectNote,
      individualNotes: {
        postNotes,
        staffPostNotes,
        grantNotes,
      }
    });
  } catch (e) {
    console.error("[GET /api/saved-categories/[id]/note]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
}

// POST /api/saved-categories/[id]/note - Create note for a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content, userId } = await req.json();
  
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Check if category exists
    const category = await categoriesCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Connect to MongoDB for notes
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Check if project note already exists
    const existingNote = await notesCollection.findOne({
      userId,
      targetId: id,
      targetType: "project",
    });

    if (existingNote) {
      return NextResponse.json({ error: "Project note already exists. Use PUT to update." }, { status: 409 });
    }

    // Create new project note
    const newNote = await notesCollection.insertOne({
      userId,
      targetId: id,
      targetType: "project",
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ 
      note: {
        _id: newNote.insertedId,
        userId,
        targetId: id,
        targetType: "project",
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  } catch (e) {
    console.error("[POST /api/saved-categories/[id]/note]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
}

// PUT /api/saved-categories/[id]/note - Update note for a project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content, userId } = await req.json();
  
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Check if category exists
    const category = await categoriesCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Connect to MongoDB for notes
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Update existing project note
    const updatedNote = await notesCollection.findOneAndUpdate(
      {
        userId,
        targetId: id,
        targetType: "project",
      },
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!updatedNote?.value) {
      return NextResponse.json({ error: "Project note not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      note: updatedNote.value
    });
  } catch (e) {
    console.error("[PUT /api/saved-categories/[id]/note]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
}

// DELETE /api/saved-categories/[id]/note - Delete note for a project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  
  try {
    const categoriesCollection = await getSavedCategoriesCollection();
    
    // Check if category exists
    const category = await categoriesCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Connect to MongoDB for notes
    await client.connect();
    const db = client.db("user_data");
    const notesCollection = db.collection("saved_notes");

    // Delete project note
    const result = await notesCollection.deleteOne({
      userId,
      targetId: id,
      targetType: "project",
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Project note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/saved-categories/[id]/note]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    await client.close();
  }
} 