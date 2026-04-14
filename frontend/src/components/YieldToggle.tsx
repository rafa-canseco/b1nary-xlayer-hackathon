export type YieldMetric = "apr" | "roi";

interface Props {
  value: YieldMetric;
  onChange: (metric: YieldMetric) => void;
}

export function YieldToggle({ value, onChange }: Props) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] overflow-hidden text-[10px] font-semibold leading-none">
      <button
        onClick={() => onChange("apr")}
        className={`px-2 py-1 transition-colors duration-150 ${
          value === "apr"
            ? "bg-[var(--accent-dim)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        APR
      </button>
      <button
        onClick={() => onChange("roi")}
        className={`px-2 py-1 transition-colors duration-150 ${
          value === "roi"
            ? "bg-[var(--accent-dim)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text)]"
        }`}
      >
        ROI
      </button>
    </span>
  );
}
