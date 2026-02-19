import { NextRequest, NextResponse } from 'next/server';
import { appendToSheet } from '../../utils/googleSheets';

export async function POST(request: NextRequest) {
  try {
    const { fullName, topic, message, timestamp, userAgent, pathname } = await request.json();

    // Validate required fields
    if (!topic || !message) {
      return NextResponse.json(
        { error: "Topic and message are required" },
        { status: 400 }
      );
    }

    // Validate topic is one of the allowed values
    const allowedTopics = ['bug', 'improvement', 'complaint', 'feature', 'general'];
    if (!allowedTopics.includes(topic)) {
      return NextResponse.json(
        { error: "Invalid topic" },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    // Prepare feedback data
    const feedbackData = {
      fullName: fullName || '',
      topic,
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString(),
      userAgent: userAgent || '',
      pathname: pathname || '',
    };

    // Submit to Google Sheets
    await appendToSheet(feedbackData);

    return NextResponse.json({ 
      success: true, 
      message: "Feedback submitted successfully" 
    });

  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check if the feedback system is working
export async function GET() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
      'GOOGLE_SHEET_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json({
        status: 'error',
        message: `Missing environment variables: ${missingVars.join(', ')}`
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Feedback system is configured and ready'
    });

  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Feedback system check failed' },
      { status: 500 }
    );
  }
} 