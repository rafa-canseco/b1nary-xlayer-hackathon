"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export function InfoTooltip({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center size-4 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-[9px] font-bold leading-none ml-1.5 shrink-0 hover:bg-[var(--accent)]/25 transition-colors cursor-help"
          aria-label={`Info: ${title}`}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="font-semibold text-[var(--bone)] mb-0.5">{title}</p>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
