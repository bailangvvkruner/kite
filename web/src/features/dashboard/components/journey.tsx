import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDotsIcon,
  PencilSimpleLineIcon,
  CloudArrowUpIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { useContentPage, useLatest, useSite, useStatusCounts, useWritable } from "@/hooks/useContents";
import { useKindLabel } from "@/hooks/useKindLabel";
import { canPublish, useDelivery, usePublish } from "@/hooks/usePublish";
import { siteHome } from "@/lib/links";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { KiteMark } from "@/components/KiteMark";
import { PublishProblems } from "@/components/publish/Delivery";
import { PublishDialog } from "@/components/publish/PublishDialog";

/**
 * Journey is the way a kind's writing goes to the reader, in four stops: a
 * draft, scheduled, saved but not yet published, and live. Each says how many
 * are there and what to do next, and a kite string runs through them.
 */
export function Journey({ kind }: { kind: string }) {
  const { t, locale } = useI18n();
  const kindLabel = useKindLabel();
  const site = useSite();
  const writable = useWritable();
  const counts = useStatusCounts(kind, ["draft", "scheduled", "published"]);
  const draft = useContentPage({ kind, status: ["draft"], sort: "-updated_at", limit: 1 }, undefined);
  const next = useContentPage({ kind, status: ["scheduled"], sort: "published_at", limit: 1 }, undefined);
  const last = useLatest(kind, 1, "-published_at");
  const delivery = useDelivery();
  const publish = usePublish([]);
  const [publishing, setPublishing] = useState(false);

  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const dateOf = (iso?: string) => (iso ? day.format(new Date(iso)) : "");
  const many = kindLabel.many(kind);
  const latestDraft = draft.data?.items[0];
  const nextUp = next.data?.items[0];
  const lastOut = last.data?.items[0];

  const d = delivery.data;
  const git = canPublish(d);
  const dirty = d?.dirty ?? [];
  const ahead = d?.ahead ?? 0;
  const failed = Boolean(d?.last_error) || d?.deployed === "failed";
  const problems = site.data?.problems?.length ?? 0;

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">{t("dashboard.journey")}</h3>
        <p className="text-xs text-muted-foreground">{t("dashboard.journeyNote")}</p>
      </div>

      <div className="relative grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        {/* The string runs behind the stops from the first one's center to the
            kite's: three of four columns and their gaps, from 20px in. On
            narrow screens the stops wrap and it is left out. */}
        <svg
          aria-hidden
          viewBox="0 0 1000 40"
          preserveAspectRatio="none"
          className="pointer-events-none absolute start-5 top-0 hidden h-10 w-[calc((100%+1rem)*0.75)] overflow-visible lg:block"
        >
          <path
            d="M0 20 C 160 -4, 300 44, 500 20 S 840 -2, 1000 20"
            fill="none"
            stroke="var(--string)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <Stop
          icon={PencilSimpleLineIcon}
          label={t("dashboard.drafts")}
          count={counts.draft}
          note={latestDraft ? latestDraft.title || latestDraft.slug : t("dashboard.noDrafts")}
          action={
            latestDraft && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/content/$kind/$id" params={{ kind, id: latestDraft.id }}>
                  {t("dashboard.continue")}
                </Link>
              </Button>
            )
          }
        />
        <Stop
          icon={CalendarDotsIcon}
          tone="planned"
          label={t("dashboard.stageScheduled")}
          count={counts.scheduled}
          note={
            nextUp
              ? `${nextUp.title || nextUp.slug} · ${dateOf(nextUp.published_at)}`
              : t("dashboard.noScheduled", { kind: many })
          }
          action={
            nextUp && (
              <Button variant="ghost" size="sm" className="-ms-2.5" asChild>
                <Link to="/content/$kind" params={{ kind }} search={{ status: ["scheduled"] }}>
                  {t("dashboard.viewAll")}
                </Link>
              </Button>
            )
          }
        />
        <Stop
          icon={failed && !dirty.length && !ahead ? WarningIcon : CloudArrowUpIcon}
          tone={failed && !dirty.length && !ahead ? "failed" : dirty.length || ahead ? "waiting" : "quiet"}
          label={t("dashboard.stagePending")}
          count={d ? (git ? dirty.length || ahead : undefined) : undefined}
          note={
            !d
              ? ""
              : !git
                ? t("deploy.cardNote")
                : dirty.length
                  ? t("dashboard.pendingFiles", { files: names(dirty, locale) })
                  : ahead
                    ? t("publish.toPush", { count: ahead })
                    : failed
                      ? t(d.last_error ? "publish.headline.error" : "publish.headline.failed")
                      : t("dashboard.allPublished")
          }
          action={
            !git ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/deploy">{t("nav.deploy")}</Link>
              </Button>
            ) : dirty.length && writable ? (
              <Button size="sm" onClick={() => setPublishing(true)}>
                {t("publish.publishAll", { count: dirty.length })}
              </Button>
            ) : ahead && writable ? (
              <Button size="sm" disabled={publish.pending} onClick={() => void publish.push()}>
                {publish.pending && <Spinner />}
                {t("publish.pushCommits", { count: ahead })}
              </Button>
            ) : failed ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/deploy">{t("publish.view")}</Link>
              </Button>
            ) : null
          }
        />
        <Stop
          mark
          label={t("dashboard.stageLive")}
          count={counts.published}
          note={
            lastOut
              ? t("dashboard.lastPublished", { date: dateOf(lastOut.published_at) })
              : t("dashboard.latestEmpty", { kind: many })
          }
          action={
            <Button variant="ghost" size="sm" className="-ms-2.5" asChild>
              <a href={siteHome(site.data)} target="_blank" rel="noreferrer">
                {t("nav.viewSite")}
              </a>
            </Button>
          }
        />
      </div>

      <PublishProblems publish={publish} />
      {problems > 0 && (
        <Link
          to="/content/$kind"
          params={{ kind }}
          className="mt-5 flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <WarningIcon className="size-4 shrink-0" />
          {t("problems.notIndexed", { count: problems })}
        </Link>
      )}
      <PublishDialog
        ids={[]}
        paths={dirty}
        open={publishing}
        onOpenChange={setPublishing}
        onDone={() => undefined}
        title={t("publish.allTitle")}
        description={t("publish.allNote", { paths: dirty.join(", ") })}
      />
    </section>
  );
}

type Tone = "quiet" | "planned" | "waiting" | "failed";

const toneClass: Record<Tone, string> = {
  quiet: "text-muted-foreground",
  planned: "text-primary",
  waiting: "text-warning",
  failed: "text-destructive",
};

function Stop({
  icon: Icon,
  mark,
  tone = "quiet",
  label,
  count,
  note,
  action,
}: {
  icon?: PhosphorIcon;
  /** mark draws the last stop as the kite itself. */
  mark?: boolean;
  tone?: Tone;
  label: string;
  /** Undefined while loading. */
  count: number | undefined;
  note: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative min-w-0">
      <div className="mb-3 flex items-center">
        {/* A backing in the card's own color cuts the string where it passes;
            only the kite has a tile of its own. */}
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-4 ring-card",
            mark ? "bg-primary" : cn("bg-card", toneClass[tone]),
          )}
        >
          {mark ? (
            <KiteMark tight className="h-4 w-auto text-white! dark:text-white!" />
          ) : (
            Icon && <Icon weight="duotone" className="size-[30px]" />
          )}
        </span>
        {/* Padded on both sides, so the string stops short of the figure. */}
        <span className="flex items-baseline gap-2 bg-card px-2.5">
          {count === undefined ? (
            <Skeleton className="h-7 w-8" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums">{count}</span>
          )}
          <span className="text-sm text-muted-foreground">{label}</span>
        </span>
      </div>
      <p className="line-clamp-2 min-h-10 text-sm text-foreground/80">{note}</p>
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** names says which files wait, by the name a writer knows them by, the rest counted. */
function names(paths: string[], locale: string): string {
  const shown = paths.slice(0, 3).map((path) => {
    const leaf = path.replace(/\/_?index\.md$/, "").split("/").pop() ?? path;
    return leaf.replace(/\.md$/, "");
  });
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(shown);
  return paths.length > shown.length ? `${list} +${paths.length - shown.length}` : list;
}
