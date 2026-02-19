export interface Grant {
  id: string; // Changed from number to string for MongoDB _id
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  title: string;
  agency: string;
  type: string;
  description: string;
  eligibility: string;
  amount: string;
  opportunityNumber: string;
  dates: string;
  url: string;
  createdAt: string;
  subfields: string[];
  // Engagement metrics
  likes?: number;
  bookmarks?: number;
  comments?: number;
  score?: number;
}

export interface GrantFormData {
  title: string;
  agency: string;
  type: string;
  description: string;
  eligibility: string;
  amount: string;
  opportunityNumber: string;
  dates: string;
  url: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalGrants: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SmartLoadResponse {
  grants: Grant[];
  targetGrantId?: number;
  totalGrants: number;
  hasMore: boolean;
}

export interface PaginatedResponse {
  grants: Grant[];
  pagination: PaginationInfo;
}

// Fetch grants with pagination
export async function fetchGrants(page: number = 1, limit: number = 20): Promise<PaginatedResponse> {
  const response = await fetch(`/api/grants?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grants');
  }
  return response.json();
}

// Smart loading: Fetch specific grant with context
export async function fetchGrantWithContext(grantId: number, contextSize: number = 5): Promise<SmartLoadResponse> {
  const response = await fetch(`/api/grants?grantId=${grantId}&contextSize=${contextSize}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grant with context');
  }
  return response.json();
}

// Fetch single grant
export async function fetchGrant(grantId: number): Promise<Grant> {
  const response = await fetch(`/api/grants?grantId=${grantId}&contextSize=0`);
  if (!response.ok) {
    throw new Error('Failed to fetch grant');
  }
  const data = await response.json();
  return data.grants[0]; // Should only return the target grant
}

// Create new grant
export async function createGrant(userId: string, grantData: GrantFormData): Promise<Grant> {
  const response = await fetch('/api/grants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      ...grantData,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create grant');
  }
  
  return response.json();
}

// Like a grant
export async function likeGrant(userId: string, grantId: string): Promise<void> {
  const response = await fetch('/api/grants/like', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, grantId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to like grant');
  }
}

// Unlike a grant
export async function unlikeGrant(userId: string, grantId: string): Promise<void> {
  const response = await fetch('/api/grants/like', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, grantId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to unlike grant');
  }
}

// Bookmark a grant
export async function bookmarkGrant(userId: string, grantId: string): Promise<void> {
  const response = await fetch('/api/grants/bookmark', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, grantId }),
  });
  
  if (response.status === 409) {
    // Already bookmarked, this is fine
    return;
  }
  
  if (!response.ok) {
    throw new Error('Failed to bookmark grant');
  }
}

// Unbookmark a grant
export async function unbookmarkGrant(userId: string, grantId: string): Promise<void> {
  const response = await fetch('/api/grants/bookmark', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, grantId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to unbookmark grant');
  }
}

// Get grant bookmarks for a user
export async function getGrantBookmarks(userId: string): Promise<{ bookmarks: any[] }> {
  const response = await fetch(`/api/grants/bookmark?userId=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grant bookmarks');
  }
  return response.json();
}

// Get grant like status and count
export async function getGrantLikeStatus(grantId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
  const response = await fetch(`/api/grants/like?grantId=${grantId}&userId=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grant like status');
  }
  return response.json();
}

// Check if a grant is bookmarked by a user
export async function isGrantBookmarked(grantId: string, userId: string): Promise<boolean> {
  const response = await fetch(`/api/grants/bookmark?userId=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grant bookmarks');
  }
  const data = await response.json();
  return data.bookmarks.some((bookmark: any) => bookmark.grant?.id === grantId);
} 

// Fetch grants with subfields (for search filtering)
export async function fetchGrantsWithSubfields(page: number = 1, limit: number = 20): Promise<PaginatedResponse> {
  const response = await fetch(`/api/grants?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch grants');
  }
  return response.json();
} 