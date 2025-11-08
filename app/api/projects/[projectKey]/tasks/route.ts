// File: app/api/projects/[projectKey]/tasks/route.ts
// This version (v5) adds the same robust fetchWithRetry helper.

import { NextResponse } from 'next/server';
console.log(
  '--- RUNNING THE LATEST TASKS ROUTE (v5 - with retries) ---'
);

// --- NEW HELPER FUNCTION ---
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
    // We add a specific timeout to the fetch request
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

    const body = {
      jql: `project="${projectKey}"`,
      fields: ['status', 'summary'],
      maxResults: 1000,
    };

    // Use the retry helper for the main fetch
    const response = await fetchWithRetry(
      `${JIRA_BASE_URL}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      }
    );

    const data = await response.json();
    const issues = data.issues || [];

    // Calculate counts
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      const status = issue.fields?.status?.name || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    }
    const calculatedTotal = issues.length;

    console.log(`✅ [${projectKey}] Data fetched (with retry logic).`);
    console.log(`   - Total Issues: ${calculatedTotal}`);
    console.log(`   - Status Counts:`, counts);

    // Return the combined object
    return NextResponse.json({
      total: calculatedTotal,
      counts: counts,
      issues: issues,
    });
  } catch (err: any) {
    console.error('❌ Server error in tasks route:', err.message);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}