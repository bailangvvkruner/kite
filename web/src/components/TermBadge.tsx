import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** TermBadge is a term, with how many items carry it, as a quiet chip on the sheet. */
export function TermBadge({
  term,
  count,
  className,
}: {
  term: string;
  count?: number;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("gap-1.5 font-normal", className)}>
      {term}
      {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
    </Badge>
  );
}
