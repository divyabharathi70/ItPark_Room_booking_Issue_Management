import Icon from "../icons/Icon";
import { buildIssueTimeline } from "../../utils/issueStorage";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const DONE_STYLE = "border-emerald-500 bg-emerald-500 text-white";
const CURRENT_STYLE = "border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100";

/**
 * Renders only the stages an issue has actually passed through, in the
 * order they happened — never a fixed 5-step template. The last entry
 * (the issue's current status) is visually highlighted.
 */
export default function IssueTimeline({ issue }) {
  const stages = buildIssueTimeline(issue);
  if (stages.length === 0) return null;

  return (
    <ol className="space-y-0">
      {stages.map((stage, idx) => {
        const isLast = idx === stages.length - 1;
        return (
          <li key={`${stage.status}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-slate-200" aria-hidden="true" />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                stage.isCurrent ? CURRENT_STYLE : DONE_STYLE
              }`}
            >
              <Icon name={stage.icon} className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className={`text-sm font-semibold ${stage.isCurrent ? "text-indigo-700" : "text-slate-800"}`}>
                  {stage.label}
                </p>
                {stage.isCurrent && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-200">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(stage.at)}</p>
              {stage.note && <p className="mt-1 text-xs text-slate-500">{stage.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
