"use client";

import { useMemo, useState } from "react";
import type { ListPayload, UrgencyTone } from "@/lib/project-status/types";

// "Option B" list design agreed with Diego: one card per item, color-coded
// left border + badge for urgency, instead of a plain markdown bullet list.
const BADGE_CLASSES: Record<UrgencyTone, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400",
  green: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const BORDER_CLASSES: Record<UrgencyTone, string> = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  slate: "border-l-slate-300 dark:border-l-slate-700",
};

export default function ListCards({ list }: { list: ListPayload }) {
  const [expanded, setExpanded] = useState(false);

  const sortedItems = useMemo(() => {
    const priority: Record<UrgencyTone, number> = { red: 0, amber: 1, blue: 2, slate: 3, green: 4 };
    return [...list.items].sort((a, b) => {
      const ap = a.badge ? priority[a.badge.tone] : 3;
      const bp = b.badge ? priority[b.badge.tone] : 3;
      return ap - bp;
    });
  }, [list.items]);

  if (list.items.length === 0) return null;

  const visibleItems = expanded ? sortedItems : sortedItems.slice(0, 5);
  const remaining = Math.max(0, sortedItems.length - 5);

  return (
    <div className="max-w-full space-y-2">
      {sortedItems.length > 5 && (
        <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
          {expanded ? `Mostrando las ${sortedItems.length} tareas` : `Mostrando las 5 tareas más críticas de ${sortedItems.length}`}
        </p>
      )}

      {visibleItems.map((item) => (
        <div
          key={item.id}
          className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${item.badge ? BORDER_CLASSES[item.badge.tone] : "border-l-slate-300 dark:border-l-slate-700"}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-5 text-slate-900 dark:text-slate-100">{item.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400 dark:text-slate-500">
              {item.subtitle && <span className="text-slate-500 dark:text-slate-400">{item.subtitle}</span>}
              {item.subtitle && item.meta && item.meta.length > 0 && <span>·</span>}
              {item.meta && item.meta.length > 0 && <span>{item.meta.join(" · ")}</span>}
            </div>
          </div>
          {item.badge && (
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_CLASSES[item.badge.tone]}`}>
              {item.badge.label}
            </span>
          )}
        </div>
      ))}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-indigo-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
        >
          {expanded ? "Mostrar menos" : `Ver las ${remaining} restantes`}
        </button>
      )}
    </div>
  );
}
