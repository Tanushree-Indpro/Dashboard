'use client';

import useSWR from 'swr';
import { LoaderCircle } from 'lucide-react';

export interface ProjectTaskCountsType {
  total: number;
  counts: Record<string, number>;
}

const fetcher = async (url: string): Promise<ProjectTaskCountsType> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody.error || errBody.details || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json().catch(() => ({}));

  return {
    total: typeof data.total === 'number' ? data.total : 0,
    counts: data.counts && typeof data.counts === 'object' ? data.counts : {},
  };
};

export function ProjectTaskCounts({ projectKey }: { projectKey: string }) {
  const { data, isLoading, error } = useSWR<ProjectTaskCountsType>(
    projectKey ? `/api/projects/${projectKey}/tasks` : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <LoaderCircle className="w-4 h-4 animate-spin" />
        <span>Loading task statuses...</span>
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-sm text-red-600">Error loading tasks.</div>;
  }

  const { total, counts } = data;

  if (!total || Object.keys(counts).length === 0) {
    return (
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="text-sm">
          <div className="text-lg font-bold text-gray-800">{total ?? 0}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      </div>
    );
  }

  const colorClasses: Record<string, string> = {
    'to do': 'text-blue-600',
    'in progress': 'text-yellow-600',
    'done': 'text-green-600',
    'review': 'text-purple-600',
    'in review': 'text-purple-600',
    'backlog': 'text-gray-500',
    'test': 'text-orange-600',
  };

  return (
    <div className="grid grid-cols-4 gap-y-4 text-center">
      <div className="text-sm">
        <div className="text-lg font-bold text-gray-800">{total}</div>
        <div className="text-xs text-gray-500">Total</div>
      </div>
      {Object.entries(counts as Record<string, number>).map(
        ([status, count]) => (
          <div key={status} className="text-sm">
            <div
              className={`text-lg font-bold ${
                colorClasses[status.toLowerCase()] || 'text-gray-700'
              }`}
            >
              {count}
            </div>
            <div className="text-xs text-gray-500 capitalize">{status}</div>
          </div>
        )
      )}
    </div>
  );
}
