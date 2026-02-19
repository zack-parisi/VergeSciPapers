import { MongoClient, Db, Collection, Document } from "mongodb";
import OpenAI from "openai";

const dbName = process.env.MONGODB_DATABASE || "verge_neuro_lit_topics";
const collectionName = process.env.MONGODB_COLLECTION || "papers_clean";
const vectorIndex = process.env.VECTOR_INDEX_NAME || "vector_index";
const embeddingModel = process.env.VECTOR_MODEL || "text-embedding-3-small";

let clientPromise: Promise<MongoClient> | null = null;

async function getCollection(): Promise<Collection<Document>> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI (or MONGODB_URI) is not configured on the server."
    );
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }

  const conn = await clientPromise;
  const db: Db = conn.db(dbName);
  return db.collection(collectionName);
}

interface QuickSearchOptions {
  limit?: number;
  numCandidates?: number;
}

export interface QuickSearchResult {
  title?: string;
  abstract?: string;
  authors_string?: string;
  journal?: string;
  publication_date?: string;
  doi?: string;
  work_id?: string;
  subfields?: string[];
  cited_by_count?: number;
  keywords?: string[];
  open_access?: boolean;
  score?: number;
}

export async function runQuickSearch(
  query: string,
  { limit = 5, numCandidates = 30 }: QuickSearchOptions = {}
): Promise<QuickSearchResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const collection = await getCollection();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const embedding = await openai.embeddings.create({
    model: embeddingModel,
    input: query,
  });

  const queryVector = embedding.data?.[0]?.embedding;

  if (!queryVector) {
    throw new Error("Failed to generate embedding for query");
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: vectorIndex,
        path: "vector",
        queryVector,
        numCandidates,
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        abstract: 1,
        authors_string: 1,
        journal: 1,
        publication_date: 1,
        doi: 1,
        work_id: 1,
        subfields: 1,
        cited_by_count: 1,
        keywords: 1,
        open_access: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  const docs = await collection.aggregate<QuickSearchResult>(pipeline).toArray();
  return docs;
}

