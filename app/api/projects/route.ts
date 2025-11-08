// File: app/api/projects/route.ts
// This version adds a robust fetchWithRetry function to handle network errors.

import { NextResponse } from 'next/server';

// This new interface will be used by your dashboard page
export interface ProjectWithCounts {
  id: string;
  key: string;
  name: string;
  lead: { displayName: string } | null;
  taskCounts: {
    total: number;
    counts: Record<string, number>;
  };
}

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
      // If the response is not ok (e.g., 500, 404), throw an error to trigger retry
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
      // Wait for the specified delay before retrying
      await new Promise((res) => setTimeout(res, delay));
      // Recursively call with one less retry and doubled delay (exponential backoff)
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    } else {
      // No retries left, throw the final error
      console.error(`❌ Final fetch attempt failed for ${url.split('atlassian.net')[1]}: ${error.message}`);
      throw error;
    }
  }
}
// --- END HELPER FUNCTION ---

export async function GET() {
  try {
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

    // 1. Fetch all projects (with retry)
    const projectRes = await fetchWithRetry(
      `${JIRA_BASE_URL}/rest/api/3/project/search`,
      {
        headers,
        cache: 'no-store',
      }
    );

    const { values } = await projectRes.json();
    const projects: ProjectWithCounts[] = [];

    for (const project of values) {
      let leadName: string | null = 'N/A';

      // 2. Get lead info (with retry)
      try {
        const detailsRes = await fetchWithRetry(
          `${JIRA_BASE_URL}/rest/api/3/project/${project.key}`,
          {
            headers,
            cache: 'no-store',
          }
        );
        if (detailsRes.ok) {
          const details = await detailsRes.json();
          leadName = details?.lead?.displayName ?? 'N/A';
        }
      } catch (err: any) {
        console.warn(
          `⚠️ Could not fetch lead for ${project.key} (even after retries): ${err.message}`
        );
      }

      // 3. Get task counts for THIS project (with retry)
      let taskCounts = { total: 0, counts: {} };
      try {
        const jqlBody = {
          jql: `project="${project.key}"`,
          fields: ['status'],
          maxResults: 1000,
        };

        const jqlRes = await fetchWithRetry(
          `${JIRA_BASE_URL}/rest/api/3/search/jql`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(jqlBody),
            cache: 'no-store',
          }
        );

        if (jqlRes.ok) {
          const jqlData = await jqlRes.json();
          const issues = jqlData.issues || [];
          const counts: Record<string, number> = {};

          for (const issue of issues) {
            const status = issue.fields?.status?.name || 'Unknown';
            counts[status] = (counts[status] || 0) + 1;
          }

          taskCounts = {
            total: issues.length,
            counts: counts,
          };
        } else {
          console.warn(`⚠️ Could not fetch tasks for ${project.key}`);
        }
      } catch (err: any) {
        console.warn(
          `⚠️ Error fetching tasks for ${project.key} (even after retries): ${err.message}`
        );
      }
      // --- END: NEWLY ADDED LOGIC ---

      // 4. Add the combined data to our final array
      projects.push({
        id: project.id,
        key: project.key,
        name: project.name,
        lead: leadName ? { displayName: leadName } : null,
        taskCounts: taskCounts,
      });
    }

    return NextResponse.json(projects);
  } catch (error: any) {
    console.error('❌ Error in /api/projects route:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}