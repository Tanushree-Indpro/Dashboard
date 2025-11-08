import React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Flag,
  ListTree,
  Link2,
} from "lucide-react";

// ---------- NEW: Interfaces for type-safety ----------
interface JiraIssueLink {
  id: string;
  type: string;
  direction: string;
  description: string;
  key: string;
  summary: string;
  status: string;
  issueType: string; // Matches your API
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
  links: JiraIssueLink[]; // <-- Added this
}

interface IssuePageProps {
  params: { projectKey: string; issueKey: string };
}

// ---------- NEW: Added formatDate helper ----------
const formatDate = (dateString?: string | null) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

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

export default async function IssuePage({ params }: IssuePageProps) {
  const { projectKey, issueKey } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/projects/${projectKey}/issues/${issueKey}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 text-center">Failed to Load Issue</h1>
        <p className="text-gray-600 mb-2 text-center">{res.status}: {errorData.details || res.statusText}</p>
        <Link
          href={`/projects/${projectKey}`}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Project
        </Link>
      </main>
    );
  }

  // Use the new interface for type safety
  const issue: JiraIssue = await res.json();

  const statusColors: Record<string, string> = {
    'to do': 'bg-blue-100 text-blue-700 border-blue-200',
    'in progress': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'done': 'bg-green-100 text-green-700 border-green-200',
    'review': 'bg-purple-100 text-purple-700 border-purple-200',
    'backlog': 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const priorityIcons: Record<string, { icon: any; color: string }> = {
    'highest': { icon: Flag, color: 'text-red-600' },
    'high': { icon: Flag, color: 'text-orange-600' },
    'medium': { icon: Flag, color: 'text-yellow-600' },
    'low': { icon: Flag, color: 'text-blue-600' },
    'lowest': { icon: Flag, color: 'text-gray-600' },
  };

  return (
    <main className="min-h-screen bg-gray-50 relative">
      <PageHeader projectKey={projectKey} />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li><Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">Dashboard</Link></li>
            <li className="text-gray-400">/</li>
            <li><Link href={`/projects/${projectKey}`} className="text-blue-600 hover:text-blue-700 font-medium">{projectKey}</Link></li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-700 font-semibold">{issueKey}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="p-6 bg-white rounded-lg shadow border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{issue.key}</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-lg border ${statusColors[issue.status?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {issue.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{issue.summary}</h1>
              <p className="text-sm text-gray-600 mt-1">{issue.type}</p>
            </div>

            {issue.priority && issue.priority.toLowerCase() !== 'none' && (
              <div className="flex-shrink-0 flex items-center gap-2">
                {React.createElement(priorityIcons[issue.priority?.toLowerCase()]?.icon || Flag, {
                  className: `w-5 h-5 ${priorityIcons[issue.priority?.toLowerCase()]?.color || 'text-gray-600'}`,
                })}
                <span className="font-medium capitalize">{issue.priority}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="p-6 bg-white rounded-lg shadow border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{issue.description || "No description provided."}</p>
        </div>

        {/* Meta Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Column 1 */}
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">People</h3>
              <div className="space-y-2">
                <p><strong>Assignee:</strong> {issue.assignee || "Unassigned"}</p>
                <p><strong>Reporter:</strong> {issue.reporter || "N/A"}</p>
              </div>
            </div>

            {issue.storyPoints != null && ( // Check for null or undefined
              <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Story Points</h3>
                <p className="text-2xl font-bold text-gray-800">{issue.storyPoints}</p>
              </div>
            )}
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dates</h3>
              {/* Use the new formatDate helper */}
              <p><strong>Created:</strong> {formatDate(issue.created)}</p>
              <p><strong>Updated:</strong> {formatDate(issue.updated)}</p>
              <p><strong>Due Date:</strong> {formatDate(issue.dueDate)}</p>
            </div>
            
            {issue.parent && (
              <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Parent Issue</h3>
                <Link
                  href={`/projects/${projectKey}/issues/${issue.parent.key}`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {issue.parent.key} — {issue.parent.summary}
                </Link>
                <p className="text-sm text-gray-500">{issue.parent.type}</p>
              </div>
            )}
          </div>
          
          {/* Column 3 (Child & Linked Issues) */}
          <div className="space-y-6">
            {issue.children?.length > 0 && (
              <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ListTree className="w-5 h-5 text-gray-700" /> Child Issues
                </h3>
                <ul className="space-y-3">
                  {issue.children.map((child: JiraIssueChild) => (
                    <li key={child.key}>
                      <Link
                        href={`/projects/${projectKey}/issues/${child.key}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {child.key} — {child.summary}
                      </Link>
                      <p className="text-sm text-gray-500">({child.status} - {child.type})</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* --- NEW: Linked Issues Card --- */}
            {issue.links?.length > 0 && (
              <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-gray-700" /> Linked Issues
                </h3>
                <ul className="space-y-3">
                  {issue.links.map((link: JiraIssueLink) => (
                    <li key={link.id}>
                      <p className="text-sm text-gray-500 capitalize">{link.description}</p>
                      <Link
                        href={`/projects/${projectKey}/issues/${link.key}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {link.key} — {link.summary}
                      </Link>
                      <p className="text-sm text-gray-500">({link.status} - {link.issueType})</p>
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