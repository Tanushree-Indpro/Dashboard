// File: app/api/projects/[projectKey]/versions/route.ts
// This version adds the fetchWithRetry helper.

import { NextResponse } from 'next/server';

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

interface JiraVersion {
  id: string;
  name: string;
  startDate?: string;
  releaseDate?: string;
  released: boolean;
  archived: boolean;
  status: string;
  issueCounts: {
    issuesFixedCount: number;
  };
}

function getVersionStatus(version: { released: boolean; archived: boolean }): string {
  if (version.archived) return 'Archived';
  if (version.released) return 'Released';
  return 'Unreleased';
}

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

    // 1. Fetch the list of versions (with retry)
    const versionListRes = await fetchWithRetry(
      `${JIRA_BASE_URL}/rest/api/3/project/${projectKey}/versions`,
      {
        headers,
        cache: 'no-store',
      }
    );

    const versionsData = await versionListRes.json();
    const processedVersions: JiraVersion[] = [];

    // 2. Loop through each version to get its issue counts
    const versionPromises = versionsData.map(async (version: any) => {
      let issueCounts = { issuesFixedCount: 0 };
      
      try {
        // 3. Get associated issue counts (with retry)
        const countsRes = await fetchWithRetry(
          `${JIRA_BASE_URL}/rest/api/3/version/${version.id}/relatedIssueCounts`,
          { headers, cache: 'no-store' }
        );

        if (countsRes.ok) {
          const countsData = await countsRes.json();
          issueCounts = {
            issuesFixedCount: countsData.issuesFixedCount || 0,
          };
        } else {
          console.warn(`Could not fetch counts for version ${version.id}`);
        }
      } catch(err: any) {
         console.warn(`Error fetching counts for ${version.id} (even after retries): ${err.message}`);
      }

      // 4. Combine all data
      return {
        id: version.id,
        name: version.name,
        startDate: version.startDate,
        releaseDate: version.releaseDate,
        released: version.released,
        archived: version.archived,
        status: getVersionStatus(version),
        issueCounts: issueCounts,
      };
    });

    const finalVersions = await Promise.all(versionPromises);

    return NextResponse.json(finalVersions);
  } catch (err: any) {
    console.error('❌ Server error in versions route:', err.message);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}