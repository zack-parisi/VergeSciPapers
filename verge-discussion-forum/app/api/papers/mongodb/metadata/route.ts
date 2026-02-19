import { NextRequest, NextResponse } from "next/server";
import { 
  getAvailableSubfields,
  getAvailableYears 
} from "../../../../../lib/mongodb-helpers";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "subfields" or "years"
    
    if (type === "subfields") {
      const subfields = await getAvailableSubfields();
      return NextResponse.json({
        success: true,
        type: "subfields",
        data: subfields,
        count: subfields.length
      });
    }
    
    if (type === "years") {
      const years = await getAvailableYears();
      return NextResponse.json({
        success: true,
        type: "years",
        data: years,
        count: years.length
      });
    }
    
    // If no specific type requested, return both
    const [subfields, years] = await Promise.all([
      getAvailableSubfields(),
      getAvailableYears()
    ]);
    
    return NextResponse.json({
      success: true,
      subfields: {
        data: subfields,
        count: subfields.length
      },
      years: {
        data: years,
        count: years.length
      }
    });
    
  } catch (error) {
    console.error("Error fetching metadata from MongoDB:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch metadata", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 