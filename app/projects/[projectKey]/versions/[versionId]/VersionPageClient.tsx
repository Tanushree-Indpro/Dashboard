'use client'; // <-- This directive is critical here

import React, { useMemo } from 'react'; // We don't need 'use'
import useSWR from 'swr';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  CheckCircle,
  ChevronRight,
  Loader2,
  Calendar,
  User,
  Flag,
  ListTodo,
  Construction,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

// ---------- Types ----------
interface JiraIssue {
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

interface JiraVersion {
  id: string;
  name: string;
  status: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
}

interface ApiVersionResponse {
  version: JiraVersion;
  issues: JiraIssue[];
}

// ---------- Fetcher ----------
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to fetch ${url}`);
  }
  return res.json();
};

// ---------- Helpers ----------
const formatDate = (d?: string) => {
  if (!d) return 'Not set';
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

const VersionStatus = ({ status }: { status?: string }) => {
  if (!status) return <span className="text-sm text-blue-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />Unreleased</span>;
  if (status === 'Released') return <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" />Released</span>;
  if (status === 'Archived') return <span className="text-sm text-gray-500 flex items-center gap-1"><Archive className="w-4 h-4" />Archived</span>;
  return <span className="text-sm text-blue-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{status}</span>;
};

const IssueStatusBadge = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  
  if (s === 'done' || s === 'fixed') {
    return <span className="text-xs font-medium px-2 py-0.5 bg-green-100 text-green-800 rounded-md flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{status}</span>;
  }
  if (s === 'in progress' || s === 'in review') {
    return <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md flex items-center gap-1"><Construction className="w-3 h-3" />{status}</span>;
  }
  if (s === 'blocked') {
    return <span className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-800 rounded-md flex items-center gap-1"><XCircle className="w-3 h-3" />{status}</span>;
  }
  return <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md flex items-center gap-1"><ListTodo className="w-3 h-3" />{status}</span>;
};


// ---------- Page Component ----------
// This component receives simple strings as props, not promises
export default function VersionPageClient({ projectKey, versionId }: {
  projectKey: string;
  versionId: string;
}) {

  const { 
    data, 
    error, 
    isLoading 
  } = useSWR<ApiVersionResponse>(
    // The props are now plain strings, so this works
    projectKey && versionId ? `/api/projects/${projectKey}/versions/${versionId}` : null,
    fetcher
  );

  // 1. Calculate stats from the data
  const stats = useMemo(() => {
    if (!data) {
      return { total: 0, todo: 0, inProgress: 0, blocked: 0, done: 0, progress: 0 };
    }
    
    const total = data.issues.length;
    let todo = 0;
    let inProgress = 0;
    let blocked = 0;
    let done = 0;

    data.issues.forEach(issue => {
      const status = issue.fields.status.name.toLowerCase();
      if (status === 'done' || status === 'fixed') done++;
      else if (status === 'in progress' || status === 'in review') inProgress++;
      else if (status === 'blocked') blocked++;
      else todo++; // Assume all others are 'To Do'
    });

    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, blocked, done, progress };
  }, [data]);

  // 2. Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // 3. Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-8 h-8 text-red-600 mt-1" />
            <div>
              <div className="font-semibold text-red-800 text-lg">Error loading release details</div>
              <div className="text-sm text-red-700 mt-2">{(error as Error).message}</div>
              <p className="text-xs text-red-600 mt-4">This usually means the API endpoint is not working or not yet created.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. No Data State (after loading)
  if (!data) {
    return <div className="p-8 text-center text-slate-500">No data found for this version.</div>;
  }

  // 5. Success State
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* --- Breadcrumbs --- */}
        <nav className="flex items-center text-sm text-slate-500 mb-4">
          <Link href="/" className="hover:underline hover:text-slate-700">Dashboard</Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <Link href={`/projects/${projectKey}`} className="font-mono px-1 bg-gray-100 rounded hover:underline hover:text-slate-700">{projectKey}</Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-slate-700">{data.version.name}</span>
        </nav>

        {/* --- Header --- */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{data.version.name}</h1>
            <div className="flex items-center gap-4 text-slate-600 mt-2">
              <span className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4" />
                {formatDate(data.version.startDate)} → {formatDate(data.version.releaseDate)}
              </span>
            </div>
          </div>
          <VersionStatus status={data.version.status} />
        </header>

        {/* --- Stats Section --- */}
        <section className="mb-8 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Release Progress</h2>
          
          <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
            <span>Progress</span>
            <span className="font-semibold text-slate-700">{stats.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
            <div style={{ width: `${stats.progress}%` }} className="bg-green-500 h-3" />
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-slate-500">To Do</span>
              <div className="text-2xl font-semibold text-slate-800">{stats.todo}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-xs text-blue-600">In Progress</span>
              <div className="text-2xl font-semibold text-blue-800">{stats.inProgress}</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <span className="text-xs text-red-600">Blocked</span>
              <div className="text-2xl font-semibold text-red-800">{stats.blocked}</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-xs text-green-600">Done</span>
              <div className="text-2xl font-semibold text-green-800">{stats.done}</div>
            </div>
          </div>
        </section>

        {/* --- Main Content (Issues & Release Notes) --- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- Issue List --- */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4 text-slate-900">Issues ({stats.total})</h2>
            <div className="space-y-3">
              {data.issues.map(issue => (
                <Link 
                  href={`/projects/${projectKey}/issues/${issue.key}`} 
                  key={issue.id} 
                  className="block p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-slate-800">{issue.fields.summary}</p>
                    <IssueStatusBadge status={issue.fields.status.name} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    <span className="font-mono text-blue-600">{issue.key}</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> 
                      {issue.fields.assignee?.displayName ?? 'Unassigned'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flag className="w-3 h-3" />
                      {issue.fields.priority.name}
                    </span>
                  </div>
                </Link>
              ))}
              {data.issues.length === 0 && (
                <div className="p-6 text-center bg-white rounded-lg border border-gray-100 text-slate-500">
                  No issues are associated with this release.
                </div>
              )}
            </div>
          </div>

          {/* --- Release Notes --- */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-slate-900">Release Notes</h2>
            <div className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
              {data.version.description ? (
                // Using prose for nice formatting of Jira's HTML description
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: data.version.description }} 
                />
              ) : (
                <p className="italic text-slate-500">No description provided for this release.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}