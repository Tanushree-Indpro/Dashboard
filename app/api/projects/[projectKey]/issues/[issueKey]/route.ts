/*
  File: app/api/projects/[projectKey]/issues/[issueKey]/route.ts
  This is the corrected version, ensuring Epic children are fetched correctly.
*/

import { NextResponse } from 'next/server';

// --- Helper: retry fetch ---
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectKey: string; issueKey: string }> }
) {
  const { issueKey } = await params;
  const decodedIssueKey = decodeURIComponent(issueKey);

  if (decodedIssueKey.includes(' ')) {
    return NextResponse.json(
      {
        error: 'Invalid issue key',
        details: `Issue key "${decodedIssueKey}" contains spaces.`,
        hint: "Use a valid Jira key like CB-1, not 'To Do'.",
      },
      { status: 400 }
    );
  }

  try {
    const { JIRA_BASE_URL, JIRA_API_USER, JIRA_API_TOKEN } = process.env;
    if (!JIRA_BASE_URL || !JIRA_API_USER || !JIRA_API_TOKEN) {
      throw new Error('Jira environment variables not set');
    }

    const auth = Buffer.from(`${JIRA_API_USER}:${JIRA_API_TOKEN}`).toString('base64');
    const authHeaders = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    };

    // --- Step 1: Fetch main issue details ---
    const fields =
      'summary,description,status,assignee,reporter,priority,labels,duedate,issuetype,parent,subtasks,created,updated,customfield_10016,issuelinks';
    const response = await fetchWithRetry(
      `${JIRA_BASE_URL}/rest/api/3/issue/${decodedIssueKey}?fields=${fields}`,
      {
        headers: authHeaders,
        cache: 'no-store',
      }
    );

    const data = await response.json();
    const issueType = data.fields.issuetype?.name || 'Unknown';

    // --- Step 2: NEW - If it's an Epic, fetch its children ---
    let epicChildren: any[] = [];
    if (issueType === 'Epic') {
      const jql = `"Epic Link" = ${decodedIssueKey} OR parent = ${decodedIssueKey}`;

      // --- THE FIX ---
      // The correct endpoint is /search (not /search/jql)
      const searchUrl = `${JIRA_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(
        jql
      )}&fields=summary,status,issuetype,priority`;
      // --- END OF FIX ---

      try {
        const searchResponse = await fetchWithRetry(searchUrl, {
          headers: authHeaders,
          cache: 'no-store',
        });
        const searchData = await searchResponse.json();
        epicChildren = searchData.issues || [];
      } catch (e: any) {
        console.warn(`⚠️ Could not fetch child issues for Epic ${decodedIssueKey}: ${e.message}`);
      }
    }

    // --- Step 3: Format the response ---
    const description =
      data.fields.description?.content
        ?.map((block: any) =>
          block.content?.map((c: any) => c.text || '').join(' ')
        )
        .join('\n') || '';

    const allChildren = [
      ...(data.fields.subtasks || []),
      ...epicChildren,
    ];

    const issue = {
      key: data.key,
      type: issueType,
      summary: data.fields.summary,
      description,
      status: data.fields.status?.name || 'Unknown',
      priority: data.fields.priority?.name || 'None',
      assignee: data.fields.assignee?.displayName || null,
      reporter: data.fields.reporter?.displayName || null,
      labels: data.fields.labels || [],
      dueDate: data.fields.duedate || null,
      created: data.fields.created,
      updated: data.fields.updated,
      storyPoints: data.fields.customfield_10016 || null,
      parent: data.fields.parent
        ? {
            key: data.fields.parent.key,
            summary: data.fields.parent.fields.summary,
            type: data.fields.parent.fields.issuetype?.name,
          }
        : null,
      children:
        allChildren.map((child: any) => ({
          key: child.key,
          summary: child.fields.summary,
          status: child.fields.status?.name,
          type: child.fields.issuetype?.name,
        })) || [],

      links:
        data.fields.issuelinks
          ?.map((link: any) => {
            const linkedIssue = link.inwardIssue || link.outwardIssue;
            if (!linkedIssue) return null;

            return {
              id: link.id,
              type: link.type.name,
              direction: link.inwardIssue ? 'inward' : 'outward',
              description: link.inwardIssue
                ? link.type.inward
                : link.type.outward,
              key: linkedIssue.key,
              summary: linkedIssue.fields.summary,
            status: linkedIssue.fields.status?.name, // Added optional chaining
            issueType: linkedIssue.fields.issuetype?.name, // Added optional chaining
            };
          })
          .filter(Boolean) || [],
    };

    return NextResponse.json(issue);
  } catch (error: any) {
    console.error('Error fetching Jira issue:', error.message);
    if (error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Issue not found', details: `Issue "${decodedIssueKey}" does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch issue details', details: error.message },
      { status: 500 }
    );
  }
}