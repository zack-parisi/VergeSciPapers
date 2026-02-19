import { google } from 'googleapis';

interface FeedbackData {
  fullName?: string;
  topic: string;
  message: string;
  timestamp: string;
  userAgent?: string;
  pathname?: string;
}

export async function appendToSheet(data: FeedbackData) {
  try {
    // Initialize OAuth2 client instead of service account
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://vergesci-v2-xagt.vercel.app' // Redirect URL for production
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheet ID not configured');
    }

    // First, try to ensure the sheet is set up properly
    await ensureSheetExists(sheets, spreadsheetId);

    // Format the timestamp for better readability
    const formattedTimestamp = new Date(data.timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Get the topic label for better readability
    const topicLabels: Record<string, string> = {
      bug: 'Bug Report',
      improvement: 'Improvement Suggestion',
      complaint: 'Complaint',
      feature: 'Feature Request',
      general: 'General Feedback',
    };

    const topicLabel = topicLabels[data.topic] || data.topic;

    // Prepare the row data
    const values = [
      [
        formattedTimestamp,
        topicLabel,
        data.message,
        data.pathname || '',
        data.userAgent || '',
        data.fullName || '',
      ],
    ];

    // Try Feedback sheet first, fallback to Sheet1
    let targetRange = 'Feedback!A:F';
    try {
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: targetRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });

      console.log('Feedback submitted to Google Sheets:', {
        updatedRows: result.data.updates?.updatedRows,
        range: result.data.updates?.updatedRange,
      });

      return { success: true, result: result.data };
    } catch (error: any) {
      // If Feedback sheet doesn't exist, try Sheet1
      if (error.message?.includes('Unable to parse range')) {
        console.log('Feedback sheet not found, trying Sheet1...');
        targetRange = 'Sheet1!A:F';
        
        const result = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: targetRange,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values,
          },
        });

        console.log('Feedback submitted to Sheet1:', {
          updatedRows: result.data.updates?.updatedRows,
          range: result.data.updates?.updatedRange,
        });

        return { success: true, result: result.data };
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error submitting feedback to Google Sheets:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
}

async function ensureSheetExists(sheets: any, spreadsheetId: string) {
  try {
    // Check if we can access Sheet1 and add headers if needed
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:F1',
    });

    if (!response.data.values || response.data.values.length === 0 || 
        !response.data.values[0].includes('Timestamp')) {
      // Add headers if they don't exist or are incorrect
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Timestamp', 'Topic', 'Message', 'Page', 'User Agent', 'User Name']],
        },
      });
      console.log('Added headers to Sheet1');
    }
  } catch (error) {
    console.log('Could not access Sheet1, will try to append anyway:', error);
  }
}

export async function initializeSheet() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://vergesci-v2-xagt.vercel.app'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('Google Sheet ID not configured');
    }

    // Ensure the sheet is properly set up
    await ensureSheetExists(sheets, spreadsheetId);

    return { success: true };
  } catch (error) {
    console.error('Error initializing Google Sheets:', error);
    throw error;
  }
} 
// Interface for signup data
interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  timestamp?: string;
}

// Function to append signup data to Google Sheets
export async function appendSignupToSheet(data: SignupData) {
  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://vergesci-v2-xagt.vercel.app'
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const spreadsheetId = process.env.GOOGLE_SIGNUP_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('Google Signup Sheet ID not configured');
    }

    // Format the timestamp for better readability
    const formattedTimestamp = new Date(data.timestamp || new Date().toISOString()).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Prepare the row data matching your headers: First Name, Last Name, Email, Signup Date
    const values = [
      [
        data.firstName,
        data.lastName,
        data.email,
        formattedTimestamp,
      ],
    ];

    // Try to append to the Signups sheet, fallback to Sheet1
    let targetRange = 'Signups!A:D';
    try {
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: targetRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });

      console.log('Signup data submitted to Google Sheets:', {
        updatedRows: result.data.updates?.updatedRows,
        range: result.data.updates?.updatedRange,
      });

      return { success: true, result: result.data };
    } catch (error: any) {
      // If Signups sheet doesn't exist, try Sheet1
      if (error.message?.includes('Unable to parse range')) {
        console.log('Signups sheet not found, trying Sheet1...');
        targetRange = 'Sheet1!A:D';
        
        const result = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: targetRange,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values,
          },
        });

        console.log('Signup data submitted to Sheet1:', {
          updatedRows: result.data.updates?.updatedRows,
          range: result.data.updates?.updatedRange,
        });

        return { success: true, result: result.data };
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error submitting signup data to Google Sheets:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
}
