import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters long' },
        { status: 400 }
      );
    }

    // Call the ROR API
    const rorApiUrl = `https://api.ror.org/v2/organizations?query=${encodeURIComponent(query)}&page=1`;
    
    const response = await fetch(rorApiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VergeSci-InstitutionSearch/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`ROR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Limit results to first 20 for performance
    const limitedData = {
      ...data,
      items: data.items?.slice(0, 20) || [],
    };

    return NextResponse.json(limitedData);
  } catch (error) {
    console.error('Institution search error:', error);
    return NextResponse.json(
      { error: 'Failed to search institutions' },
      { status: 500 }
    );
  }
} 