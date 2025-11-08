import { NextResponse } from 'next/server';

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
  _req: Request,
  context: { params: Promise<{ projectKey: string }> }
) {
  try {
    const { projectKey } = await context.params;
    if (!projectKey) {
      return NextResponse.json({ error: 'Project key is required' }, { status: 400 });
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

    // -----------------------------------------------------------------
    // THE REAL FIX: Use the correct endpoint with the correct parameter
    // This is the simplest way to get all users associated with a project.
    // The parameter is 'project', NOT 'projectKey'.
    // -----------------------------------------------------------------
    const usersRes = await fetchWithRetry(
      `${JIRA_BASE_URL}/rest/api/3/user/assignable/search?project=${projectKey}`,
      {
        headers,
        cache: 'no-store',
      }
    );

    const usersData = await usersRes.json();
    
    // Add a log to see if we are successful now
    console.log(`✅ [${projectKey}] Successfully fetched users. Count: ${usersData.length}`);

    // We just pass the array of users. The client will get the length.
    return NextResponse.json(usersData);

  } catch (err: any) {
    console.error(`❌ Server error in users route:`, err.message);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}