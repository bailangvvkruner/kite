import type { ReactNode } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react";

import { useI18n, type Key } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSection } from "./sections";

/**
 * Group is a titled part of a settings form: a stop on the page's route,
 * numbered as the route numbers it, with its title set in the wordmark's
 * serif. Its fields fill the width, two to a line where a Row says half.
 */
export function Group({
  id,
  title,
  note,
  changed,
  problem,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  /** changed marks the group on the route as holding unsaved changes. */
  changed?: boolean;
  /** problem marks it as holding a value that cannot be saved. */
  problem?: boolean;
  children: ReactNode;
}) {
  const number = useSection({ id, title, changed, problem });
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mb-9 scroll-mt-2 border-b pb-9 last-of-type:mb-0 last-of-type:border-b-0 last-of-type:pb-2"
    >
      <header className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {number && (
          <span aria-hidden className="text-xs font-semibold tracking-[0.06em] text-string tabular-nums">
            {number}
          </span>
        )}
        <h2 id={`${id}-title`} className="font-serif text-[22px] leading-snug font-bold tracking-[0.03em]">
          {title}
        </h2>
        {note && <p className="text-[13.5px] text-muted-foreground">{note}</p>}
      </header>
      <div className="grid gap-x-5 gap-y-6 @xl/form:grid-cols-2 [&>*:not([data-half])]:col-span-full">{children}</div>
    </section>
  );
}

/**
 * Row is one labelled field, with a line of help under it when it needs one,
 * and a note after that about what else decides the setting. A problem takes
 * the help's place, since it is what the person has to act on.
 */
export function Row({
  id,
  label,
  help,
  note,
  half,
  optional,
  meta,
  problem,
  children,
}: {
  id: string;
  label: Key;
  help?: Key;
  note?: ReactNode;
  /** half lets the row share its line with the next half row. */
  half?: boolean;
  optional?: boolean;
  /** meta is a short fact at the label's end, such as a count. */
  meta?: ReactNode;
  problem?: string | null;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div data-half={half || undefined} className="grid min-w-0 content-start gap-2">
      <div className="flex min-h-4 items-baseline gap-2">
        <Label htmlFor={id}>{t(label)}</Label>
        {optional && <span className="text-xs text-muted-foreground/80">{t("form.optional")}</span>}
        {meta && <span className="ms-auto text-xs text-muted-foreground tabular-nums">{meta}</span>}
      </div>
      {children}
      {problem ? (
        <p role="alert" className="flex items-center gap-1.5 text-[13px] text-destructive">
          <WarningCircleIcon className="size-4 shrink-0" />
          {problem}
        </p>
      ) : (
        help && <p className="text-[13px] leading-relaxed text-muted-foreground">{t(help)}</p>
      )}
      {note && <p className="text-[13px] leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

/** SwitchRow is a setting that is on or off, said beside its switch. */
export function SwitchRow({
  id,
  label,
  help,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: Key;
  help?: Key;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start justify-between gap-6 rounded-lg border px-4 py-3.5">
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{t(label)}</Label>
        {help && <p className="text-[13px] leading-relaxed text-muted-foreground">{t(help)}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </div>
  );
}
