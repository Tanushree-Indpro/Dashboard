/*
  File: app/page.tsx
  Highlights:
  - CHANGED (Line 217): Added new logic to sort versions and find the *true* latest version.
  - CHANGED (Line 256): Added 'relative z-10' to fix CSS stacking issue.
*/

'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  AlertCircle,
  Calendar,
  BarChart3,
  Loader2,
  TrendingUp,
  CheckCircle,
  Archive,
  Database,
} from 'lucide-react';

// ---------- Types ----------
// Type for Jira Version data
interface JiraVersion {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  releaseDate?: string;
  issueCounts?: { issuesFixedCount?: number; totalIssues?: number };
}

// Type for user data
interface JiraUser {
  accountId: string;
  displayName: string;
}

// Type for project health
interface ProjectHealth {
  status: 'Healthy' | 'At Risk' | 'Critical';
  progress: number;
  totalProjectIssues: number;
  blocked: number;
  versionFixed: number;
  versionTotal: number;
}

// Type for the final, enriched API project
interface ApiProject {
  id: string;
  key: string;
  name: string;
  lead: { displayName: string } | null;
  taskCounts?: { total: number; counts: Record<string, number> };
  latestVersion?: JiraVersion;
  members: number;
  health: ProjectHealth;
}

// ---------- Fetcher ----------
const fetcher = async (url: string) => {
  // Fetch data with error handling
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to fetch ${url}`);
  }
  return res.json();
};

// ---------- Helpers ----------
const formatDate = (d?: string) => {
  // Format date for display
  if (!d) return 'Not set';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
};

// Calculate project health based on version data
const getVersionBasedHealth = (
  taskCounts: { total: number; counts: Record<string, number> },
  latestVersion?: JiraVersion
): ProjectHealth => {
  const totalProjectIssues = taskCounts?.total ?? 0;
  const blocked = taskCounts?.counts?.Blocked ?? taskCounts?.counts?.blocked ?? 0;
  const versionTotal = latestVersion?.issueCounts?.issuesFixedCount ?? 0;
  const counts = taskCounts?.counts ?? {};
  const versionFixed = (counts.Done ?? counts.done ?? 0) + (counts.Fixed ?? counts.fixed ?? 0);
  const progress = versionTotal > 0 ? Math.round((versionFixed / versionTotal) * 100) : 0;

  let status: 'Healthy' | 'At Risk' | 'Critical' = 'Healthy';

  // A project is considered Critical if:
  if (progress < 40 || blocked >= 5) status = 'Critical';
  else if (progress < 70 || blocked >= 2) status = 'At Risk';

  return { status, progress, totalProjectIssues, blocked, versionFixed, versionTotal };
};

// Component to display version status
const VersionStatus = ({ status }: { status?: string }) => {
  if (!status)
    return (
      <span className="text-sm text-blue-600 flex items-center gap-1">
        <AlertCircle className="w-4 h-4" />
        Unreleased
      </span>
    );
  if (status === 'Released')
    return (
      <span className="text-sm text-green-600 flex items-center gap-1">
        <CheckCircle className="w-4 h-4" />
        Released
      </span>
    );
  if (status === 'Archived')
    return (
      <span className="text-sm text-gray-500 flex items-center gap-1">
        <Archive className="w-4 h-4" />
        Archived
      </span>
    );
  return (
    <span className="text-sm text-blue-600 flex items-center gap-1">
      <AlertCircle className="w-4 h-4" />
      {status}
    </span>
  );
};

// ---------- UI Component ----------
export default function Home() {
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'Healthy' | 'At Risk' | 'Critical'
  >('all');

  // Fetch projects, tasks, versions, and users
  const { data: projects, error, isLoading } = useSWR<
    Omit<ApiProject, 'taskCounts' | 'latestVersion' | 'members' | 'health'>[]
  >('/api/projects', fetcher, {
    refreshInterval: 30 * 60 * 1000, // 30 minutes refresh
    revalidateOnFocus: false,
  });

  const projectKeys = projects?.map((p) => p.key) ?? [];
  const { data: tasksArray } = useSWR(
    projectKeys.length ? projectKeys.map((k) => `/api/projects/${k}/tasks`) : null,
    async (urls: string[]) => {
      const res = await Promise.all(
        urls.map((u) => fetcher(u).catch(() => ({ total: 0, counts: {} })))
      );
      return res;
    },
    { refreshInterval: 60 * 1000 }
  );

  const { data: versionsArray } = useSWR(
    projectKeys.length
      ? projectKeys.map((k) => `/api/projects/${k}/versions`)
      : null,
    async (urls: string[]) => {
      const res = await Promise.all(
        urls.map((u) => fetcher(u).catch(() => []))
      );
      return res;
    },
    { refreshInterval: 60 * 1000 }
  );

  const { data: usersArray } = useSWR(
    projectKeys.length
      ? projectKeys.map((k) => `/api/projects/${k}/users`)
      : null,
    async (urls: string[]) => {
      const res = await Promise.all(
        urls.map((u) => fetcher(u).catch(() => []))
      );
      return res as JiraUser[][];
    },
    { refreshInterval: 60 * 1000 }
  );

  // Enrich projects with additional data
  const enrichedProjects = useMemo((): ApiProject[] => {
    if (!projects) return [];
    return projects.map((p, i) => {
      const taskData = tasksArray?.[i] ?? { total: 0, counts: {} };
      const versions: JiraVersion[] = versionsArray?.[i] ?? [];
      
      // --- FIX 2: ROBUST VERSION SORTING ---
      // Filter out archived versions and sort by release/start date
      // to find the most recent, relevant version.
      const sortedVersions = versions
        .filter((v) => v.status !== 'Archived')
        .sort((a, b) => {
          const dateA = a.releaseDate || a.startDate;
          const dateB = b.releaseDate || b.startDate;
          if (dateA && dateB) {
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          }
          if (dateA) return 1; // Versions with dates are "later"
          if (dateB) return -1;
          return a.name.localeCompare(b.name); // Fallback to name sort
        });

      // The latest version is the last one in the sorted list
      const latestVersion = sortedVersions.length
        ? sortedVersions[sortedVersions.length - 1]
        : undefined;
      // --- END OF FIX ---
      
      const userList: JiraUser[] = usersArray?.[i] ?? [];
      const members = userList.length;
      const health = getVersionBasedHealth(taskData, latestVersion);

      return {
        ...p,
        taskCounts: taskData,
        latestVersion,
        members,
        health,
      };
    });
  }, [projects, tasksArray, versionsArray, usersArray]);

  // Calculate header stats
  const stats = useMemo(() => {
    const total = enrichedProjects.length;
    const healthy = enrichedProjects.filter(
      (p) => p.health.status === 'Healthy'
    ).length;
    const atRisk = enrichedProjects.filter(
      (p) => p.health.status === 'At Risk'
    ).length;
    const critical = enrichedProjects.filter(
      (p) => p.health.status === 'Critical'
    ).length;
    return { total, healthy, atRisk, critical };
  }, [enrichedProjects]);

  // Filter projects based on status
  const filteredProjects = useMemo(() => {
    if (filterStatus === 'all') return enrichedProjects;
    return enrichedProjects.filter((p) => p.health.status === filterStatus);
  }, [enrichedProjects, filterStatus]);

  return (
    <main className="min-h-screen bg-gray-50 relative">
      {/* Background Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/bg-logo.svg"
          alt="Background Logo"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-auto opacity-[0.02] select-none"
        />
      </div>

      {/* Top Navigation Bar */}
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
                  Project Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-700">Live</span>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {/* --- FIX 1: LAYOUT/STACKING FIX --- */}
      {/* Added 'relative z-10' to ensure this content block renders 'on top' of the z-0 background logo */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">
                Project Overview
              </h2>
              <p className="text-sm text-gray-500">
                Monitor and track all JIRA projects
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-5 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Projects
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Healthy
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {stats.healthy}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    At Risk
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    {stats.atRisk}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Critical
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.critical}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Projects</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredProjects.length} of {stats.total} projects
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('Healthy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === 'Healthy'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Healthy
            </button>
            <button
              onClick={() => setFilterStatus('At Risk')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === 'At Risk'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              At Risk
            </button>
            <button
              onClick={() => setFilterStatus('Critical')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === 'Critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Critical
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading projects...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">
                Error Loading Projects
              </h3>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {!isLoading && !error && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p, index) => {
              const {
                status,
                progress,
                totalProjectIssues,
                blocked,
                versionFixed,
                versionTotal,
              } = p.health;
              const latest = p.latestVersion;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="h-full"
                >
                  <article className="bg-white rounded-lg p-5 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/projects/${p.key}`}
                            className="block group"
                          >
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                              {p.name}
                            </h3>
                          </Link>
                          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-gray-700">
                              {p.key}
                            </span>
                            <span>•</span>
                            <span>
                              Lead:{' '}
                              <strong className="text-slate-700">
                                {p.lead?.displayName ?? 'Unassigned'}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            status === 'Healthy'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status === 'At Risk'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {status}
                        </div>
                      </div>

                      {/* Latest Version Block */}
                      <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-slate-600">
                        {/* --- "Releases" HEADING --- */}
                        <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">
                          Releases
                        </h4>
                        {latest ? (
                          <Link
                            href={`/projects/${p.key}/versions/${latest.id}`}
                            className="block rounded-md -m-2 p-2 hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-800">
                                  {latest.name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {formatDate(latest.startDate)} →{' '}
                                  {formatDate(latest.releaseDate)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Issues:{' '}
                                  <span className="font-medium text-slate-700">
                                    {versionFixed} / {versionTotal > 0 ? versionTotal : '?'}
                                  </span>
                                </div>
                              </div>
                              <VersionStatus status={latest.status} />
                            </div>
                          </Link>
                        ) : (
                          <div className="italic text-slate-500 -m-2 p-2">
                            No release info
                          </div>
                        )}
                      </div>

                      {/* --- "Other Project Details" HEADING --- */}
                      <h4 className="text-xs font-semibold uppercase text-gray-400 mb-3 pt-4 border-t border-gray-100">
                        Other Project Details
                      </h4>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                          <span className="font-medium text-gray-600">
                            Progress
                          </span>
                          <span className="font-semibold text-gray-900">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                            className={`h-full ${
                              status === 'Healthy'
                                ? 'bg-emerald-500'
                                : status === 'At Risk'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 mt-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Due</p>
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {formatDate(latest?.releaseDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Team</p>
                          <p className="text-xs font-medium text-gray-900">
                            {p.members}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Issues</p>
                          <p className="text-xs font-medium text-gray-900">
                            {totalProjectIssues}
                          </p>
                        </div>
                      </div>
                      
                      {/* --- "Data Collection" BUTTON --- */}
                      <div className="flex items-center">
                        <Link
                          href={`/projects/${p.key}/issues`}
                          className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 p-2.5 rounded-lg transition-colors"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Data Collection</span>
                        </Link>
                      </div>
                      {/* --- END OF CHANGE --- */}

                    </div>
                  </article>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading &&
          !error &&
          filteredProjects.length === 0 &&
          enrichedProjects.length > 0 && (
            <div className="text-center py-20">
              <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                <BarChart3 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No projects match this filter
              </h3>
              <p className="text-gray-600 mb-6">
                Try selecting a different status filter
              </p>
              <button
                onClick={() => setFilterStatus('all')}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Show All Projects
              </button>
            </div>
          )}

        {/* Final Empty State */}
        {!isLoading && !error && enrichedProjects.length === 0 && (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
            <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
              <BarChart3 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No projects found
            </h3>
            <p className="text-sm text-gray-500">
              There are no active projects to display
            </p>
          </div>
        )}
      </div>
    </main>
  );
}