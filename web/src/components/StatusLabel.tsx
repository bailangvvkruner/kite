import {
  ArchiveIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  CircleDashedIcon,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { useI18n, type Key } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Each status's icon and color, by the rule explore's console keeps: green is
 * live, blue is on its way, gray is not public.
 */
export const statuses: Record<string, { icon: PhosphorIcon; className: string }> = {
  published: { icon: CheckCircleIcon, className: "text-success" },
  scheduled: { icon: CalendarDotsIcon, className: "text-info" },
  draft: { icon: CircleDashedIcon, className: "text-muted-foreground" },
  archived: { icon: ArchiveIcon, className: "text-muted-foreground" },
};

/** A status as its icon and name, both in the status's color. */
export function StatusLabel({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const { icon: Icon, className: tone } = statuses[status] ?? statuses.draft;
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", tone, className)}>
      {/* text-current keeps the status color where a parent grays out plain icons, as a select does. */}
      <Icon className="size-4 shrink-0 text-current" />
      {t(`status.${status}` as Key)}
    </span>
  );
}

// A pill's tint, by the same rule as the label's color.
const pills: Record<string, string> = {
  published: "bg-success/10 text-success",
  scheduled: "bg-info/10 text-info",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

/** A status as a tinted pill with its name, for rows where an icon would crowd. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap",
        pills[status] ?? pills.draft,
        className,
      )}
    >
      {t(`status.${status}` as Key)}
    </span>
  );
}
