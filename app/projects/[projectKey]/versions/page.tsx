/*
  File: app/projects/[projectKey]/versions/page.tsx
  Purpose: Displays a list of all versions for a project.
*/
'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Loader2,
  AlertCircle,
  Archive,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  List,
  Calendar,
  Package,
} from 'lucide-react';

// ---------- Types ----------
interface JiraVersion {
  id: string;
  name: string;
  status: string;
  description?: string;
  startDate?: string;
  releaseDate?: string; // This is the 'target date'
  issueCounts?: {
    totalIssues: number;
    issuesFixedCount: number;
    issuesInProgressCount: number;
    issuesToDoCount: number;
  };
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

// ---------- Helpers (copied from VersionPageClient) ----------
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

// ---------- Page Component ----------
export default function AllVersionsPage() {
  const params = useParams();
  const projectKey = params.projectKey as string;

  const {
    data: versions,
    error,
    isLoading,
  } = useSWR<JiraVersion[]>(
    projectKey ? `/api/projects/${projectKey}/versions` : null,
    fetcher
  );

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* --- Breadcrumbs --- */}
        <nav className="flex items-center text-sm text-slate-500 mb-4">
          <Link href="/" className="hover:underline hover:text-slate-700">Dashboard</Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <Link href={`/projects/${projectKey}`} className="font-mono px-1 bg-gray-100 rounded hover:underline hover:text-slate-700">{projectKey}</Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-slate-700">All Versions</span>
        </nav>

        {/* --- Header --- */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <List className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Project Releases
              </h1>
              <p className="text-sm text-gray-500">
                All versions for project: <strong className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{projectKey}</strong>
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
        </header>

        {/* --- Loading State --- */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading versions...</p>
          </div>
        )}

        {/* --- Error State --- */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Error Loading Versions</h3>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        )}

        {/* --- Success State (Versions List) --- */}
        {versions && (
          <div className="bg-white rounded-lg border border-gray-200 shadow overflow-hidden">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Issue Count</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/projects/${projectKey}/versions/${v.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <VersionStatus status={v.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(v.startDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(v.releaseDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center gap-1.5">
                         <Package className="w-4 h-4 text-gray-400" />
                         {/* Display total issues from the 'issueCounts' object */}
                         <span>{v.issueCounts?.totalIssues ?? 'N/A'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {versions.length === 0 && (
               <div className="text-center py-12">
                 <h3 className="text-lg font-semibold text-gray-900">No Versions Found</h3>
                 <p className="text-sm text-gray-500">This project does not have any versions defined.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}