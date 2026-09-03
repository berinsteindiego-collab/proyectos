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
  if (list.items.length === 0) return null;

  return (
    <div className="max-w-full space-y-2">
      {list.items.map((item) => (
        <div
          key={item.id}
          className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
            item.badge ? BORDER_CLASSES[item.badge.tone] : "border-l-slate-300 dark:border-l-slate-700"
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
            {item.subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
            )}
            {item.meta && item.meta.length > 0 && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{item.meta.join(" · ")}</p>
            )}
          </div>
          {item.badge && (
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_CLASSES[item.badge.tone]}`}
            >
              {item.badge.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
