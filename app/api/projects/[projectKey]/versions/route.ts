/*
  File: app/api/projects/[projectKey]/versions/route.ts
  This version is correct and efficient.
*/

import { NextResponse } from 'next/server';

// --- HELPER FUNCTION ---
/**
 * A robust fetch wrapper that retries on network failures.
 */
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

    // --- UPDATED LOGIC ---
    // This is a single, efficient call to get all versions
    // AND their issue counts at the same time.
    const versionsUrl = `${JIRA_BASE_URL}/rest/api/3/project/${projectKey}/versions?expand=issueCounts`;

    const response = await fetchWithRetry(
      versionsUrl,
      {
        headers,
        cache: 'no-store',
      }
    );

    // This data is an array of version objects,
    // already including the 'issueCounts' and 'status' fields.
    const data = await response.json();

    // We can just return the data directly, as it matches
    // the structure expected by the frontend (JiraVersion[]).
    return NextResponse.json(data);
    // --- END UPDATED LOGIC ---

  } catch (err: any) {
    console.error('❌ Server error in versions route:', err.message);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}