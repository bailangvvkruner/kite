import { cn } from "@/lib/utils";

/**
 * termChip draws a term as a small card pressed into the sheet, its count in
 * a well at its end, as the tags page lays them out; small fits a panel.
 */
export function termChip(small?: boolean) {
  return cn(
    "inline-flex items-center rounded-[9px] border border-input border-b-input-edge bg-card shadow-xs transition-[border-color,box-shadow] outline-none hover:border-input-edge focus-visible:ring-[3px] focus-visible:ring-field-ring",
    small ? "h-7 gap-1.5 ps-2.5 pe-1 text-[13px]" : "h-8 gap-2 ps-3 pe-[5px] text-[13.5px]",
  );
}

/** TermCount is how many items carry a term, in the well at its chip's end. */
export function TermCount({ count, small }: { count: number; small?: boolean }) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-md bg-muted text-muted-foreground tabular-nums",
        small ? "h-5 min-w-5 px-1 text-[11px]" : "h-[22px] min-w-[22px] px-1.5 text-[11.5px]",
      )}
    >
      {count}
    </span>
  );
}
