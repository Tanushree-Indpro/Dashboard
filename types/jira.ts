// File: types/jira.ts

// 🧮 Represents the dynamic task counts returned by your API
export interface ProjectTaskCounts {
  total: number;
  counts: Record<string, number>; // dynamically maps each status → count
}

// 📁 Basic Project structure used across components
export interface Project {
  id: string;
  key: string;
  name: string;
  lead: {
    displayName: string;
  } | null; // nullable to handle missing leads
  statuses?: string[]; // optional field for status list
}

// 🔍 Response structure for JIRA Search API (used by /api/projects)
export interface JiraSearchResponse {
  issues: {
    id: string;
    key: string;
    fields: {
      project: {
        id: string;
        key: string;
        name: string;
        lead?: {
          displayName: string;
        };
      };
    };
  }[];
}

// 🧾 Detailed JIRA Issue response (used in Issue Details page)
export interface JiraIssueResponse {
  key: string;
  fields: {
    summary: string;
    description?: {
      content?: Array<{
        content?: Array<{ text?: string }>;
      }>;
    };
    status: { name: string };
    assignee?: { displayName: string };
    reporter?: { displayName: string };
    priority?: { name: string };
    labels?: string[];
    duedate?: string;
    created: string;
    updated: string;
    members: string;
  };
}

// --- ADDED ---
// 릴 Represents a "Release" or "Version" in Jira
export interface JiraVersion {
  id: string;
  name: string;
  startDate?: string;
  releaseDate?: string;
  released: boolean;
  archived: boolean;
  // --- Custom fields from our API ---
  status: 'Unreleased' | 'Released' | 'Archived' | string;
  issueCounts: {
    issuesFixedCount: number;
  };
}
// --- END ADDED ---

// This helper centralizes all Jira API calls and authentication
export async function jiraFetch(path: string) {
  const { JIRA_BASE_URL, JIRA_API_USER, JIRA_API_TOKEN } = process.env;

  if (!JIRA_BASE_URL || !JIRA_API_USER || !JIRA_API_TOKEN) {
    throw new Error('Jira environment variables are not set.');
  }

  const apiHost = `https://${JIRA_BASE_URL}`;
  const url = new URL(path, apiHost).toString();

  // Encode "email:api_token" in Base64 for Basic Auth
  const authToken = Buffer.from(
    `${JIRA_API_USER}:${JIRA_API_TOKEN}`
  ).toString('base64');

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Basic ${authToken}`,
  };

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: headers,
      cache: 'no-store', // We want live data
    });

    if (!res.ok) {
      // If Jira returns an error, try to parse it and throw a useful message
      const errorBody = await res.json().catch(() => ({}));
      const errorMessage = 
        errorBody?.errorMessages?.join(', ') || 
        errorBody?.message || 
        `Jira API request failed with status ${res.status}`;
      
      throw new Error(errorMessage);
    }

    return res.json();

  } catch (error) {
    console.error(`Error in jiraFetch for path: ${path}`, error);
    // Re-throw the error to be caught by the API route
    throw error;
  }
}

// 1. MODIFY your existing JiraVersion to add the description
export interface JiraVersion {
  id: string;
  name: string;
  startDate?: string;
  releaseDate?: string;
  released: boolean;
  archived: boolean;
  description?: string; // <-- ADD THIS FIELD
  // --- Custom fields from our API ---
  status: 'Unreleased' | 'Released' | 'Archived' | string;
  issueCounts: {
    issuesFixedCount: number;
  };
}

// 2. ADD THIS NEW TYPE for the simple issue list
export interface JiraIssueSimple {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    priority: {
      name: string;
    };
    assignee: {
      displayName: string;
    } | null;
  };
}

// 3. ADD THIS NEW TYPE for the SWR hook
export interface ApiVersionResponse {
  version: JiraVersion;
  issues: JiraIssueSimple[];
}