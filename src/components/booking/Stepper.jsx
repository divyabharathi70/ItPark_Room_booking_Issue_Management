import Icon from "../icons/Icon";

const DEFAULT_STEPS = [
  { n: 1, label: "Room" },
  { n: 2, label: "Date & Time" },
  { n: 3, label: "Duration" },
  { n: 4, label: "Amenities" },
  { n: 5, label: "Review" },
];

export default function Stepper({ current, steps = DEFAULT_STEPS }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2">
      {steps.map((step, idx) => {
        const done = current > step.n;
        const active = current === step.n;
        return (
          <li key={step.n} className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                  done
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : active
                    ? "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-50"
                    : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? <Icon name="check" className="h-4 w-4" strokeWidth={2.4} /> : step.n}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  active ? "text-slate-900" : done ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-px w-4 shrink-0 sm:w-8 ${done ? "bg-indigo-500" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
