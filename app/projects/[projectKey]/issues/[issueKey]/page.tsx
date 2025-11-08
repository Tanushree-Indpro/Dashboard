/*
  File: app/projects/[projectKey]/issues/[issueKey]/page.tsx
  Purpose: Displays the full details for a single Jira issue with an improved, professional UI.
*/

import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Flag,
  ListTree,
  Link2,
  User,
  Calendar,
  Tag,
  Hash,
  MessageSquare,
  ClipboardList,
  Clock,
  ExternalLink,
} from 'lucide-react';

// ---------- Interfaces for type-safety ----------
interface JiraIssueLink {
  id: string;
  type: string;
  direction: string;
  description: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
}

interface JiraIssueChild {
  key: string;
  summary: string;
  status: string;
  type: string;
}

interface JiraIssueParent {
  key: string;
  summary: string;
  type: string;
}

interface JiraIssue {
  key: string;
  type: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  dueDate: string | null;
  created: string;
  updated: string;
  storyPoints: number | null;
  parent: JiraIssueParent | null;
  children: JiraIssueChild[];
  links: JiraIssueLink[];
}

interface IssuePageProps {
  params: { projectKey: string; issueKey: string };
}

// ---------- Helper: formatDate ----------
const formatDate = (dateString?: string | null) => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', // Changed to 'short' for a slightly more compact look
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

// ---------- Component: PageHeader (Remains similar as it's a site-wide element) ----------
const PageHeader = ({ projectKey }: { projectKey: string }) => (
  <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
      <Link href="/" className="flex items-center gap-3">
        <img src="/bg-logo.svg" alt="Indpro Logo" className="h-8 w-auto" />
        <div className="border-l border-gray-300 h-6 mx-2"></div>
        <p className="text-xs text-gray-500 font-medium">Project Dashboard</p>
      </Link>
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
  </nav>
);

// ---------- Status Badge Component (Enhanced) ----------
const StatusBadge = ({ status }: { status: string }) => {
  const statusColors: Record<string, string> = {
    'to do': 'bg-blue-50 text-blue-700 border-blue-200',
    'in progress': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    done: 'bg-green-50 text-green-700 border-green-200',
    'in review': 'bg-purple-50 text-purple-700 border-purple-200',
    backlog: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  const bgColor = statusColors[status.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgColor}`}
    >
      {status}
    </span>
  );
};

// ---------- Priority Icon Component (Enhanced) ----------
const PriorityDisplay = ({ priority }: { priority: string }) => {
  const priorityConfig: Record<string, { icon: any; color: string; label: string }> = {
    highest: { icon: Flag, color: 'text-red-600', label: 'Highest' },
    high: { icon: Flag, color: 'text-orange-500', label: 'High' },
    medium: { icon: Flag, color: 'text-yellow-500', label: 'Medium' },
    low: { icon: Flag, color: 'text-blue-500', label: 'Low' },
    lowest: { icon: Flag, color: 'text-gray-500', label: 'Lowest' },
    none: { icon: Flag, color: 'text-gray-400', label: 'None' }, // Added for explicit 'None'
  };

  const config = priorityConfig[priority.toLowerCase()] || priorityConfig.none;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <IconComponent className={`w-4 h-4 ${config.color}`} />
      <span className="font-medium">{config.label}</span>
    </div>
  );
};

// ---------- Type Icon Component (Enhanced) ----------
const TypeDisplay = ({ type }: { type: string }) => {
  const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
    task: { icon: ClipboardList, color: 'text-blue-500', label: 'Task' },
    story: { icon: MessageSquare, color: 'text-green-500', label: 'Story' },
    epic: { icon: Tag, color: 'text-purple-500', label: 'Epic' },
    bug: { icon: AlertCircle, color: 'text-red-500', label: 'Bug' },
    default: { icon: Hash, color: 'text-gray-500', label: 'Issue' },
  };
  const config = typeConfig[type.toLowerCase()] || typeConfig.default;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <IconComponent className={`w-4 h-4 ${config.color}`} />
      <span className="font-medium">{config.label}</span>
    </div>
  );
};

// ---------- Detail Item Component for consistent styling ----------
const DetailItem: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}> = ({ label, value, icon: Icon }) => (
  <div className="flex items-center py-2 border-b border-gray-100 last:border-b-0">
    {Icon && <Icon className="w-4 h-4 text-gray-500 mr-3 flex-shrink-0" />}
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="text-sm text-gray-800 break-words">{value}</div>
    </div>
  </div>
);

// ---------- Main Page Component ----------
export default async function IssuePage({ params }: IssuePageProps) {
  const { projectKey, issueKey } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const res = await fetch(
    `${baseUrl}/api/projects/${projectKey}/issues/${issueKey}`,
    {
      cache: 'no-store',
    }
  );

  // --- Error Handling ---
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <PageHeader projectKey={projectKey} /> {/* Keep header consistent */}
        <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 text-center max-w-lg mx-auto mt-10">
          <AlertCircle className="w-12 h-12 text-red-500 mb-6 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Failed to Load Issue
          </h1>
          <p className="text-gray-600 mb-6 text-sm">
            {res.status}: {errorData.details || res.statusText}
          </p>
          <Link
            href={`/projects/${projectKey}/issues`} // Link back to the all-issues page
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200"
          >
            ← Back to All Issues
          </Link>
        </div>
      </main>
    );
  }

  // --- Data & UI Configs ---
  const issue: JiraIssue = await res.json();

  const jiraIssueBaseUrl = process.env.JIRA_BASE_URL; // Assuming you have this env var

  // --- Render Page ---
  return (
    <main className="min-h-screen bg-gray-50 relative">
      <PageHeader projectKey={projectKey} />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link
                href="/"
                className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
              >
                Dashboard
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link
                href={`/projects/${projectKey}/issues`} // Link to the all-issues page
                className="text-gray-500 hover:text-blue-600 font-medium transition-colors"
              >
                {projectKey} Issues
              </Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-700 font-semibold">{issueKey}</li>
          </ol>
        </nav>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Main Issue Details) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Header & Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <TypeDisplay type={issue.type} /> {/* Enhanced Type Display */}
                  <span className="text-lg font-mono text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
                    {issue.key}
                  </span>
                  <StatusBadge status={issue.status} /> {/* Enhanced Status Badge */}
                </div>
                <PriorityDisplay priority={issue.priority} /> {/* Enhanced Priority Display */}
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
                {issue.summary}
              </h1>
              {jiraIssueBaseUrl && (
                <a
                  href={`${jiraIssueBaseUrl}/browse/${issue.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                >
                  View in Jira <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-gray-600" /> Description
              </h2>
              <div className="text-gray-700 leading-relaxed prose prose-blue max-w-none">
                {issue.description ? (
                  <p className="whitespace-pre-wrap">{issue.description}</p>
                ) : (
                  <p className="text-gray-500 italic">No description provided.</p>
                )}
              </div>
            </div>

            {/* Child Issues Section */}
            {issue.children?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  <ListTree className="w-6 h-6 text-gray-600" /> Child Issues
                </h3>
                <ul className="divide-y divide-gray-100">
                  {issue.children.map((child: JiraIssueChild) => (
                    <li key={child.key} className="py-3 flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <TypeDisplay type={child.type} />
                      </div>
                      <div>
                        <Link
                          href={`/projects/${projectKey}/issues/${child.key}`}
                          className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors"
                        >
                          {child.key} — {child.summary}
                        </Link>
                        <p className="text-sm text-gray-500 mt-1">
                          <StatusBadge status={child.status} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column (Sidebar Details) */}
          <div className="lg:col-span-1 space-y-6">
            {/* General Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Details</h3>
              <div className="divide-y divide-gray-100">
                <DetailItem label="Type" value={<TypeDisplay type={issue.type} />} icon={ClipboardList} />
                <DetailItem label="Status" value={<StatusBadge status={issue.status} />} icon={Tag} />
                <DetailItem label="Priority" value={<PriorityDisplay priority={issue.priority} />} icon={Flag} />
                {issue.storyPoints != null && (
                  <DetailItem label="Story Points" value={issue.storyPoints} icon={Hash} />
                )}
              </div>
            </div>

            {/* People */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">People</h3>
              <div className="divide-y divide-gray-100">
                <DetailItem label="Assignee" value={issue.assignee || 'Unassigned'} icon={User} />
                <DetailItem label="Reporter" value={issue.reporter || 'N/A'} icon={User} />
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Dates</h3>
              <div className="divide-y divide-gray-100">
                <DetailItem label="Created" value={formatDate(issue.created)} icon={Calendar} />
                <DetailItem label="Updated" value={formatDate(issue.updated)} icon={Clock} />
                <DetailItem label="Due Date" value={formatDate(issue.dueDate)} icon={Calendar} />
              </div>
            </div>

            {/* Parent Issue */}
            {issue.parent && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ListTree className="w-5 h-5 text-gray-700" /> Parent Issue
                </h3>
                <Link
                  href={`/projects/${projectKey}/issues/${issue.parent.key}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors block mb-1"
                >
                  {issue.parent.key} — {issue.parent.summary}
                </Link>
                <p className="text-sm text-gray-500">{issue.parent.type}</p>
              </div>
            )}

            {/* Linked Issues */}
            {issue.links?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-gray-700" /> Linked Issues
                </h3>
                <ul className="divide-y divide-gray-100">
                  {issue.links.map((link: JiraIssueLink) => (
                    <li key={link.id} className="py-3">
                      <p className="text-xs text-gray-500 capitalize mb-1">
                        {link.description}
                      </p>
                      <Link
                        href={`/projects/${projectKey}/issues/${link.key}`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors"
                      >
                        {link.key} — {link.summary}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        ({link.status} - {link.issueType})
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}