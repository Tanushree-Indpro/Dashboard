/*
  File: app/projects/[projectKey]/issues/page.tsx
  Purpose: Displays a formatted table of all Tasks, Stories, and Epics.
*/

'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Loader2,
  AlertCircle,
  Database,
  ChevronLeft,
  Flag,
  CheckCircle,
  Activity,
  ListTodo,
  Book,
  Rocket,
  FileText,
} from 'lucide-react';

// --- Types ---
interface ProjectIssue {
  key: string;
  summary: string;
  status: string;
  type: 'Task' | 'Story' | 'Epic' | string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | string;
  assignee: string | null;
  created: string;
  updated: string;
}

// --- Fetcher ---
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to fetch ${url}`);
  }
  return res.json();
};

// --- Helpers ---
const formatDate = (dateString?: string | null) => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const statusColors: Record<string, string> = {
  'to do': 'bg-blue-100 text-blue-800',
  'in progress': 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
  'in review': 'bg-purple-100 text-purple-800',
  test: 'bg-orange-100 text-orange-800',
  backlog: 'bg-gray-100 text-gray-800',
};

const priorityConfig: Record<string, { icon: any; color: string }> = {
  highest: { icon: Flag, color: 'text-red-600' },
  high: { icon: Flag, color: 'text-orange-500' },
  medium: { icon: Flag, color: 'text-yellow-500' },
  low: { icon: Flag, color: 'text-green-500' },
  lowest: { icon: Flag, color: 'text-gray-500' },
};

const typeConfig: Record<string, { icon: any; color: string }> = {
  task: { icon: CheckCircle, color: 'text-blue-500' },
  story: { icon: Book, color: 'text-green-500' },
  epic: { icon: Rocket, color: 'text-purple-500' },
  bug: { icon: AlertCircle, color: 'text-red-500' },
  default: { icon: FileText, color: 'text-gray-500' },
};

// --- Components ---
const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
      statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800'
    }`}
  >
    {status}
  </span>
);

const PriorityIcon = ({ priority }: { priority: string }) => {
  const config = priorityConfig[priority.toLowerCase()];
  if (!config) return <span className="text-xs text-gray-500">—</span>;

  return React.createElement(config.icon, {
    className: `w-4 h-4 ${config.color}`,
  });
};

const TypeIcon = ({ type }: { type: string }) => {
  const config = typeConfig[type.toLowerCase()] || typeConfig.default;

  return React.createElement(config.icon, {
    className: `w-4 h-4 ${config.color} flex-shrink-0`,
  });
};

export default function IssueDataCollectionPage() {
  const params = useParams();
  const key = params.projectKey as string;

  const {
    data: issues,
    error,
    isLoading,
  } = useSWR<ProjectIssue[]>(
    key ? `/api/projects/${key}/all-issues` : null,
    fetcher
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/bg-logo.svg"
                alt="Indpro Logo"
                className="h-8 w-auto"
              />
              <div className="border-l border-gray-300 h-6 mx-2"></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Issue Data Collection
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Issue Data Collection
              </h2>
              <p className="text-sm text-gray-500">
                Found {issues?.length ?? 0} tasks, stories, and epics for project:{' '}
                <strong className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {key}
                </strong>
              </p>
            </div>
          </div>
        </header>

        {/* Data Display Area */}
        <div className="bg-white rounded-lg border border-gray-200 shadow overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600 font-medium">
                Fetching issue data...
              </p>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-red-900 mb-1">
                    Error Loading Data
                  </h3>
                  <p className="text-red-700 text-sm">{error.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* --- NEW: Issues Table --- */}
          {issues && !isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Key
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Summary
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Priority
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Assignee
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {issues.map((issue) => (
                    <tr key={issue.key}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/projects/${key}/issues/${issue.key}`}
                          className="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {issue.key}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap max-w-sm truncate">
                        <span
                          className="text-sm text-gray-800"
                          title={issue.summary}
                        >
                          {issue.summary}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-2 text-sm text-gray-700">
                          <TypeIcon type={issue.type} />
                          {issue.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-2 text-sm text-gray-700 capitalize">
                          <PriorityIcon priority={issue.priority} />
                          {issue.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {issue.assignee || (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(issue.updated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {issues?.length === 0 && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Database className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                No Issues Found
              </h3>
              <p className="text-sm text-gray-500">
                This project does not have any Tasks, Stories, or Epics.
              </p>
            </div>
          )}
          {/* --- End of Table --- */}
        </div>
      </div>
    </main>
  );
}