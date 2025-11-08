// File: app/api/projects/[projectKey]/versions/route.ts
// This is the new, correct version that manually calculates stats.

import { NextResponse } from 'next/server';

// --- HELPER FUNCTION ---
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
      console.error(
        `❌ Final fetch attempt failed for ${
          url.split('atlassian.net')[1]
        }: ${error.message}`
      );
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

    // --- NEW LOGIC: We run two API calls in parallel ---
    const [versionsRes, issuesRes] = await Promise.all([
      // 1. Get all versions for the project (same as before, but without 'expand')
      fetchWithRetry(
        `${JIRA_BASE_URL}/rest/api/3/project/${projectKey}/versions`,
        {
          headers,
          cache: 'no-store',
        }
      ),
      // 2. Get all issues for the project to calculate stats ourselves
      fetchWithRetry(
        `${JIRA_BASE_URL}/rest/api/3/search/jql`,
        {
          method: 'POST',
          headers,
          cache: 'no-store',
          body: JSON.stringify({
            jql: `project = "${projectKey}"`, // Get all issues
            fields: ['status', 'fixVersions'], // Get status and version
            maxResults: 1000,
          }),
        }
      ),
    ]);

    const versions = await versionsRes.json();
    const issuesData = await issuesRes.json();
    const issues = issuesData.issues || [];

    // --- This is the same calculation logic from your VersionPageClient ---
    // Create a map to store our calculated stats
    const versionStatsMap = new Map<string, { done: number; total: number }>();

    for (const issue of issues) {
      const status = issue.fields.status?.name.toLowerCase() || 'unknown';
      const fixVersions = issue.fields.fixVersions;

      if (fixVersions && fixVersions.length > 0) {
        // An issue can be in multiple versions. We count it for all of them.
        for (const version of fixVersions) {
          const versionId = version.id;

          if (!versionStatsMap.has(versionId)) {
            versionStatsMap.set(versionId, { done: 0, total: 0 });
          }

          const stats = versionStatsMap.get(versionId)!;
          stats.total++;

          // Match the "done" logic from your VersionPageClient
          if (status === 'done' || status === 'fixed') {
            stats.done++;
          }
          versionStatsMap.set(versionId, stats);
        }
      }
    }

    // --- Merge our calculated stats into the versions array ---
    const finalVersions = versions.map((version: any) => {
      const stats = versionStatsMap.get(version.id);
      
      // Overwrite Jira's 'issueCounts' with our *correct* calculated stats
      const newIssueCounts = {
        issuesFixedCount: stats?.done ?? 0,
        totalIssues: stats?.total ?? 0,
      };

      return {
        ...version,
        issueCounts: newIssueCounts,
      };
    });

    return NextResponse.json(finalVersions);
    // --- End of new logic ---

  } catch (err: any) {
    console.error('❌ Server error in versions route:', err.message);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}