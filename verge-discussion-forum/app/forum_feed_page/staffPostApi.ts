export interface StaffPost {
  id: number;
  userId: string;
  title: string;
  authors: string[];
  publicationDate: string;
  citedByCount: number;
  abstract: string;
  doi: string;
  linkId: string;
  citation: string;
  subfields: string[];
  createdAt: string;
  journal?: string;
  // User interaction fields
  likes?: number;
  comments?: number;
  bookmarks?: number;
  reposts?: number;
  relevanceScore?: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalPosts: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SmartLoadResponse {
  posts: StaffPost[];
  targetPostId?: number;
  totalPosts: number;
  hasMore: boolean;
}

export interface PaginatedResponse {
  posts: StaffPost[];
  pagination: PaginationInfo;
}

// Fetch posts with pagination
export async function fetchStaffPosts(page: number = 1, limit: number = 20): Promise<PaginatedResponse> {
  try {
    // Try MongoDB first
    const response = await fetch(`/api/staff-posts/mongodb?page=${page}&limit=${limit}`);
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.log('MongoDB staff posts failed, trying Prisma fallback');
  }
  
  // Fallback to Prisma
  const response = await fetch(`/api/staff-posts?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch staff posts');
  }
  return response.json();
}

// Smart loading: Fetch specific post with context
export async function fetchStaffPostWithContext(postId: number, contextSize: number = 5): Promise<SmartLoadResponse> {
  const response = await fetch(`/api/staff-posts?postId=${postId}&contextSize=${contextSize}`);
  if (!response.ok) {
    throw new Error('Failed to fetch staff post with context');
  }
  return response.json();
}

// Fetch single staff post
export async function fetchStaffPost(postId: number): Promise<StaffPost> {
  const response = await fetch(`/api/staff-posts?postId=${postId}&contextSize=0`);
  if (!response.ok) {
    throw new Error('Failed to fetch staff post');
  }
  const data = await response.json();
  return data.posts[0]; // Should only return the target post
}

// Create new staff post
export async function createStaffPost(userId: string, data: Omit<StaffPost, 'id' | 'userId' | 'createdAt'>): Promise<StaffPost> {
  const response = await fetch('/api/staff-posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, ...data }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create staff post');
  }
  
  return response.json();
} 