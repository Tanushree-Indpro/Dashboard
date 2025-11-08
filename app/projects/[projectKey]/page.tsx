import {
  Key,
  User,
  SquareKanban,
  CheckCircle,
  Archive,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

/* --------------------
  Interfaces
  -------------------- */

// Added a simple type for JiraVersion
interface JiraVersion {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  releaseDate?: string;
  issueCounts?: {
    issuesFixedCount?: number;
  };
}

interface JiraTask {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: { name: string };
    [k: string]: any;
  };
}

interface ProjectTaskData {
  total: number;
  counts: Record<string, number>;
  issues: JiraTask[];
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  lead: { displayName: string };
}

/* --------------------
  Data Fetchers
  -------------------- */
async function getProjectTasks(projectKey: string): Promise<ProjectTaskData> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects/${projectKey}/tasks`, {
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`Failed to fetch tasks for ${projectKey}: ${res.status}`);
    return { total: 0, counts: {}, issues: [] };
  }
  try {
    const data = await res.json();
    return data as ProjectTaskData;
  } catch (e) {
    console.error("Failed to parse tasks JSON", e);
    return { total: 0, counts: {}, issues: [] };
  }
}

async function getProjectVersions(projectKey: string): Promise<JiraVersion[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects/${projectKey}/versions`, {
    cache: "no-store",
  });
  return res.ok ? await res.json() : [];
}

async function getAllProjects(): Promise<JiraProject[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/projects`, { cache: "no-store" });
  return res.ok ? await res.json() : [];
}

/* --------------------
  UI Components
  -------------------- */
const PageHeader = () => (
  <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-3">
          <img src="/bg-logo.svg" alt="Indpro Logo" className="h-8 w-auto" />
          <div className="border-l border-gray-300 h-6 mx-2"></div>
          <p className="text-xs text-gray-500 font-medium">Project Dashboard</p>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
            T
          </div>
        </div>
      </div>
    </div>
  </nav>
);

const formatDate = (dateString?: string) => {
  if (!dateString) return "Not set";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const VersionStatus = ({ status }: { status: string }) => {
  const statusMap: Record<string, { icon: React.ElementType; color: string }> = {
    Unreleased: { icon: AlertCircle, color: "text-blue-600" },
    Released: { icon: CheckCircle, color: "text-green-600" },
    Archived: { icon: Archive, color: "text-gray-500" },
  };
  const { icon: Icon, color } = statusMap[status] || statusMap.Unreleased;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {status}
    </span>
  );
};

/* --------------------
  Page Component
  -------------------- */
export default async function ProjectDetailPage({
  params,
}: {
  params: { projectKey: string };
}) {
  const { projectKey } = await params;

  const [projects, tasks, versions] = await Promise.all([
    getAllProjects(),
    getProjectTasks(projectKey),
    getProjectVersions(projectKey),
  ]);

  const project = projects.find((p) => p.key === projectKey);

  const groupedTasks = (tasks?.issues || []).reduce((acc, task) => {
    if (!task?.fields?.status) return acc;
    const status = (task.fields.status.name || "Unknown").trim();
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {} as Record<string, JiraTask[]>);

  const statusNames = Object.keys(groupedTasks);

  const statusConfig: Record<
    string,
    { bgColor: string; borderColor: string; badgeColor: string }
  > = {
    "to do": {
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      badgeColor: "bg-blue-600 text-white",
    },
    "in progress": {
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      badgeColor: "bg-amber-600 text-white",
    },
    done: {
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      badgeColor: "bg-emerald-600 text-white",
    },
    review: {
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      badgeColor: "bg-purple-600 text-white",
    },
    "in review": {
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      badgeColor: "bg-purple-600 text-white",
    },
    backlog: {
      bgColor: "bg-gray-100",
      borderColor: "border-gray-200",
      badgeColor: "bg-gray-600 text-white",
    },
    blocked: {
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      badgeColor: "bg-red-600 text-white",
    },
  };

  const total = tasks.issues.length;
  let todo = 0;
  let inProgress = 0;
  let blocked = 0;
  let done = 0;

  tasks.issues.forEach((issue) => {
    if (!issue?.fields?.status) return;
    const status = issue.fields.status.name.toLowerCase();
    if (status === "done" || status === "fixed") done++;
    else if (status === "in progress" || status === "in review") inProgress++;
    else if (status === "blocked") blocked++;
    else todo++;
  });

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const stats = { total, todo, inProgress, blocked, done, progress };

  return (
    <main className="min-h-screen bg-gray-50 relative">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/bg-logo.svg"
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-auto opacity-[0.02] select-none"
        />
      </div>

      <PageHeader />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8 relative z-10">
        {!project ? (
          <div className="text-center p-10 bg-white rounded-lg border border-gray-200">
            <h1 className="text-2xl font-bold text-red-600">Project Not Found</h1>
            <p className="mt-3 text-gray-600">
              The requested project could not be found.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <header className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">
                    {project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Key className="w-4 h-4" />
                      <span className="font-mono">{project.key}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>{project.lead.displayName}</span>
                    </span>
                  </div>
                </div>
                <Link
                  href="/"
                  className="mt-4 sm:mt-0 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </header>

            <section className="mb-8 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">Project Progress</h2>

              <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                <span>Progress</span>
                <span className="font-semibold text-slate-700">
                  {stats.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div
                  style={{ width: `${stats.progress}%` }}
                  className="bg-green-500 h-3"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs text-slate-500">To Do</span>
                  <div className="text-2xl font-semibold text-slate-800">
                    {stats.todo}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="text-xs text-blue-600">In Progress</span>
                  <div className="text-2xl font-semibold text-blue-800">
                    {stats.inProgress}
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <span className="text-xs text-red-600">Blocked</span>
                  <div className="text-2xl font-semibold text-red-800">
                    {stats.blocked}
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="text-xs text-green-600">Done</span>
                  <div className="text-2xl font-semibold text-green-800">
                    {stats.done}
                  </div>
                </div>
              </div>
            </section>

            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <SquareKanban className="w-5 h-5 text-blue-600" />
                Task Board
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {statusNames.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-4 text-center text-gray-600 p-10 bg-white rounded-lg border border-gray-200">
                  No tasks found for this project.
                </div>
              ) : (
                statusNames.map((status) => {
                  const config =
                    statusConfig[status.toLowerCase()] || {
                      bgColor: "bg-gray-100",
                      borderColor: "border-gray-200",
                      badgeColor: "bg-gray-600 text-white",
                    };

                  const tasksForStatus = groupedTasks[status] || [];

                  return (
                    <div
                      key={status}
                      className="bg-white rounded-lg border border-gray-200 flex flex-col"
                    >
                      <div
                        className={`flex items-center gap-3 p-4 border-b ${config.borderColor} ${config.bgColor}`}
                      >
                        <h2 className="text-base font-semibold uppercase tracking-wide text-gray-700">
                          {status}
                        </h2>
                        <span
                          className={`ml-auto text-xs font-semibold rounded-full px-2.5 py-0.5 ${config.badgeColor}`}
                        >
                          {tasksForStatus.length}
                        </span>
                      </div>

                      <div className="p-4 space-y-3 overflow-y-auto h-72">
                        {tasksForStatus.map((task) => (
                          <Link
                            key={task.id}
                            href={`/projects/${projectKey}/issues/${task.key}`}
                            className="block bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
                          >
                            <h3 className="font-medium text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {task.fields.summary}
                            </h3>
                            <div className="text-xs text-gray-400 font-mono mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                              <span>{task.key}</span>
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                                T
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}