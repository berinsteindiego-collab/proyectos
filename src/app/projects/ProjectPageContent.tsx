"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectBrief from "@/components/ProjectBrief";
import ProjectStatusDashboard from "@/components/ProjectStatusDashboard";
import TaskTable from "@/components/TaskTable";
import ProjectSearch from "@/components/ProjectSearch";
import type { ProjectSearchResult, ProjectStatus } from "@/lib/project-status/types";

export default function ProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "";

  const [data, setData] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProjectSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setError(null);
    setMatches(null);
    fetch(`/api/projects/${encodeURIComponent(name)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          if (res.status === 409 && body.matches) {
            setMatches(body.matches as ProjectSearchResult[]);
            setData(null);
            return;
          }
          throw new Error(body.error ?? "Error desconocido");
        }
        setData(body as ProjectStatus);
      })
      .catch((err) => {
        setData(null);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [name]);

  return (
    <div className="space-y-6">
      <ProjectSearch initialValue={name} />

      {loading && <p className="text-sm text-slate-500">Cargando...</p>}
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {matches && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Hay más de un proyecto que coincide con &quot;{name}&quot;. ¿Cuál buscabas?
          </p>
          <ul className="mt-3 space-y-1">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => router.push(`/projects?name=${encodeURIComponent(m.name)}`)}
                  className="text-sm font-medium text-slate-900 underline hover:text-slate-600"
                >
                  {m.name}
                </button>
                {m.status && <span className="ml-2 text-xs text-slate-500">({m.status})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && (
        <div className="space-y-6">
          <ProjectBrief status={data} />
          <ProjectStatusDashboard status={data} />
          <TaskTable tasks={data.tasks} />
        </div>
      )}
    </div>
  );
}
