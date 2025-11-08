/*
  File: app/api/projects/[projectKey]/all-issues/route.ts
  Highlights:
  - FIXED (Line 77-94): Changed the API call from GET to POST.
    The /search/jql endpoint requires a POST request with the
    JQL in the body. This fixes the bug that would break the
    'Data Collection' page.
*/

import { NextResponse } from 'next/server';

// --- Helper: retry fetch (copied from your other API route) ---
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Jira API Error: ${response.status} ${response.statusText}`
      );
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
      console.error(
        `❌ Final fetch attempt failed for ${
          url.split('atlassian.net')[1]
        }: ${error.message}`
      );
      throw error;
    }
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectKey: string }> }
) {
  const { projectKey } = await params;

  try {
    const { JIRA_BASE_URL, JIRA_API_USER, JIRA_API_TOKEN } = process.env;
    if (!JIRA_BASE_URL || !JIRA_API_USER || !JIRA_API_TOKEN) {
      throw new Error('Jira environment variables not set');
    }

    const auth = Buffer.from(`${JIRA_API_USER}:${JIRA_API_TOKEN}`).toString(
      'base64'
    );
    const authHeaders = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json', // Added for POST
    };

    const jql = `project = "${projectKey}" AND issuetype IN (Task, Story, Epic)`;
    const fields = [
      'summary',
      'status',
      'issuetype',
      'priority',
      'assignee',
      'created',
      'updated',
    ];

    // --- THE FIX: Use POST for /search/jql ---
    const searchUrl = `${JIRA_BASE_URL}/rest/api/3/search/jql`;
    const body = {
      jql: jql,
      fields: fields,
      maxResults: 1000,
    };

    const response = await fetchWithRetry(searchUrl, {
      method: 'POST', // <-- Must be POST
      headers: authHeaders,
      body: JSON.stringify(body), // <-- JQL goes in the body
      cache: 'no-store',
    });
    // --- END OF FIX ---

    const data = await response.json();

    const issues = data.issues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      type: issue.fields.issuetype?.name || 'Unknown',
      priority: issue.fields.priority?.name || 'None',
      assignee: issue.fields.assignee?.displayName || null,
      created: issue.fields.created,
      updated: issue.fields.updated,
    }));

    return NextResponse.json(issues);
  } catch (error: any) {
    console.error(`Error fetching all issues for ${projectKey}:`, error.message);
    return NextResponse.json(
      { error: 'Failed to fetch issues', details: error.message },
      { status: 500 }
    );
  }
}