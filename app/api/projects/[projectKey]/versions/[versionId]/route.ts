import { NextResponse, type NextRequest } from 'next/server';

// --- Re-using your fetchWithRetry helper ---
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Jira API Error Response:`, errorData);
      throw new Error(`Jira API Error: ${response.status} ${response.statusText}`);
    }
    return response;
  } catch (error: any) {
    if (retries > 0) {
      console.warn(
        `⚠️ fetch failed for ${url.split('atlassian.net')[1]}. Retrying... (${
          retries - 1
        } attempts left)`
      );
      await new Promise((res) => setTimeout(res, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    } else {
      console.error(`❌ Final fetch attempt failed for ${url.split('atlassian.net')[1]}: ${error.message}`);
      throw error;
    }
  }
}
// --- END HELPER FUNCTION ---

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectKey: string; versionId: string }> }
) {
  try {
    const { projectKey, versionId } = await context.params;

    if (!projectKey || !versionId) {
      return NextResponse.json(
        { error: 'Project key and version ID are required' },
        { status: 400 }
      );
    }

    const { JIRA_BASE_URL, JIRA_API_USER, JIRA_API_TOKEN } = process.env;

    if (!JIRA_BASE_URL || !JIRA_API_USER || !JIRA_API_TOKEN) {
      throw new Error('Missing Jira environment variables');
    }

    const auth = Buffer.from(`${JIRA_API_USER}:${JIRA_API_TOKEN}`).toString(
      'base64'
    );
    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    // --- THIS IS THE FIX ---
    // We create a JQL body for the POST request
    const jqlBody = {
      jql: `fixVersion = ${versionId}`,
      fields: ['summary', 'status', 'priority', 'assignee'],
    };
    // --- END FIX ---

    // We'll run both Jira API calls in parallel for speed
    const [versionDetails, versionIssues] = await Promise.all([
      // 1. Get the version's details (this was already correct)
      fetchWithRetry(
        `${JIRA_BASE_URL}/rest/api/3/version/${versionId}`, 
        { headers, cache: 'no-store' }
      ).then(res => res.json()),
      
      // 2. Get all issues for that version (using the correct POST /jql endpoint)
      fetchWithRetry(
        `${JIRA_BASE_URL}/rest/api/3/search/jql`, // <-- Correct endpoint
        { 
          method: 'POST', // <-- Correct method
          headers, 
          cache: 'no-store',
          body: JSON.stringify(jqlBody) // <-- Correct body
        }
      ).then(res => res.json()),
    ]);

    // Combine the results into the shape our page component expects
    const responseData = {
      version: versionDetails,
      issues: versionIssues.issues, // The search endpoint returns an 'issues' array
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Failed to fetch version details from Jira:', error);
    const errorMessage = (error as Error).message;
    
    // Pass the error message from Jira (if it exists)
    return NextResponse.json(
      { error: 'Failed to fetch data from Jira', details: errorMessage },
      { status: 500 }
    );
  }
}