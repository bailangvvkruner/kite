import { Link } from "@tanstack/react-router";
import { CaretRightIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { useLatest, useMonthlyCounts, useStatusCounts, useTerms } from "@/hooks/useContents";
import { useKindLabel, useTaxonomyLabel } from "@/hooks/useKindLabel";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/query-error";

/** Panel is a dashboard card: a title, a quiet note or link beside it, then its body. */
function Panel({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-5 sm:p-6", className)}>
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="flex-1 font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** LatestPosts is what went out last, newest first, each one a way back in. */
export function LatestPosts({ kind }: { kind: string }) {
  const { t, locale } = useI18n();
  const kindLabel = useKindLabel();
  const latest = useLatest(kind, 6, "-published_at");
  const total = useStatusCounts(kind, ["all"]).all;
  const items = latest.data?.items ?? [];
  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  return (
    <Panel
      title={t("dashboard.latest", { kind: kindLabel.many(kind) })}
      className="lg:col-span-3"
      aside={
        <Link
          to="/content/$kind"
          params={{ kind }}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          {total === undefined ? t("dashboard.viewAll") : t("dashboard.allOf", { count: total })}
          <CaretRightIcon className="size-4" />
        </Link>
      }
    >
      {latest.error && !latest.data ? (
        <QueryError error={latest.error} onRetry={() => void latest.refetch()} />
      ) : latest.isPending ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {t("dashboard.latestEmpty", { kind: kindLabel.many(kind) })}
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} className="border-t first:border-t-0">
              <Link
                to="/content/$kind/$id"
                params={{ kind: item.kind, id: item.id }}
                className="-mx-2 flex h-12 items-center gap-4 rounded-lg px-2 hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{item.title || item.slug}</span>
                <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">
                  {(item.taxonomies?.tags ?? []).map((tag) => `#${tag}`).join(" ")}
                </span>
                <span className="w-16 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
                  {item.published_at ? day.format(new Date(item.published_at)) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Rhythm is how often a kind went out in each of the last twelve months, as
 * bars small enough to read at a glance, with the tags used most under them.
 */
export function Rhythm({ kind, taxonomy }: { kind: string; taxonomy?: string }) {
  const { t, locale } = useI18n();
  const counts = useMonthlyCounts(kind, 12);
  const month = new Intl.DateTimeFormat(locale, { month: "narrow" });
  const long = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const totals = counts.months.map((entry) => entry.total);
  const loaded = totals.every((total) => total !== undefined);
  const sum = totals.reduce<number>((all, total) => all + (total ?? 0), 0);
  const peak = Math.max(1, ...totals.map((total) => total ?? 0));

  return (
    <Panel
      title={t("dashboard.rhythm")}
      className="lg:col-span-2"
      aside={
        loaded && (
          <span className="text-xs text-muted-foreground">{t("dashboard.rhythmNote", { count: sum })}</span>
        )
      }
    >
      {counts.error ? (
        <QueryError error={counts.error} onRetry={counts.refetch} />
      ) : (
        <div className="pt-3">
          <div className="flex h-28 items-end gap-1.5 border-b pb-1">
            {counts.months.map((entry) => (
              <div
                key={entry.month.toISOString()}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${long.format(entry.month)} · ${entry.total ?? 0}`}
              >
                {!!entry.total && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">{entry.total}</span>
                )}
                <span
                  className={cn("w-full max-w-4 rounded-[5px]", entry.total ? "bg-primary" : "bg-muted")}
                  // Empty months keep a stub, so the year still reads as twelve.
                  style={{ height: entry.total ? `${(entry.total / peak) * 76}%` : 4 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {counts.months.map((entry) => (
              <span key={entry.month.toISOString()} className="flex-1 text-center text-[10px] text-muted-foreground">
                {month.format(entry.month)}
              </span>
            ))}
          </div>
        </div>
      )}
      {taxonomy && <TopTerms kind={kind} taxonomy={taxonomy} />}
    </Panel>
  );
}

/** TopTerms are the tags used most, each opening the listing it narrows to. */
function TopTerms({ kind, taxonomy }: { kind: string; taxonomy: string }) {
  const { t } = useI18n();
  const taxonomyLabel = useTaxonomyLabel();
  const terms = useTerms(taxonomy);
  const items = (terms.data?.items ?? []).slice(0, 8);
  if (!items.length) return null;

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>{t("dashboard.topTerms", { name: taxonomyLabel(taxonomy) })}</span>
        <Link to="/taxonomies/$taxonomy" params={{ taxonomy }} className="hover:text-foreground">
          {t("dashboard.viewAll")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Link
            key={item.term}
            to="/content/$kind"
            params={{ kind }}
            search={{ terms: [`${taxonomy}:${item.term}`] }}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs hover:bg-accent hover:text-foreground"
          >
            {item.term}
            <span className="text-muted-foreground tabular-nums">{item.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
