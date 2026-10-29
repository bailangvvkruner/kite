import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  ArrowsMergeIcon,
  DotsThreeIcon,
  ListBulletsIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import type { components } from "@/api/client";
import { useI18n } from "@/i18n";
import { useWritable } from "@/hooks/useContents";
import { useKindLabel } from "@/hooks/useKindLabel";
import { followRowLink } from "@/lib/row-link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemRow, useTermItems, type TermProps } from "./term-parts";

type Item = components["schemas"]["TermItem"];

/**
 * CategoryCard is one category as a column of the blog: its name, how its
 * last twelve months went, and its newest items. A click anywhere opens its
 * items; the menu also its page on the site and the changes to it.
 */
export function CategoryCard({ term, taxonomy, kind, canMerge, onAction }: TermProps) {
  const { t } = useI18n();
  const kindLabel = useKindLabel();
  const { items, pending } = useTermItems(taxonomy, term.term);
  const search = { terms: [`${taxonomy}:${term.term}`] };
  const unit = term.count === 1 ? kindLabel.one(kind) : kindLabel.many(kind);

  return (
    <div
      onClick={followRowLink}
      className="flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-5 pb-3 text-card-foreground transition-colors hover:border-input-edge"
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <Link
          to="/content/$kind"
          params={{ kind }}
          search={search}
          data-row-link
          className="min-w-0 truncate font-serif text-[22px] leading-snug font-bold tracking-[0.02em] outline-none focus-visible:underline"
        >
          {term.term}
        </Link>
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {t("terms.countShort", { count: term.count, kind: unit })}
        </span>
        <TermMenu
          term={term.term}
          url={term.url}
          kind={kind}
          search={search}
          canMerge={canMerge}
          onAction={onAction}
        />
      </div>
      {term.variants?.length ? (
        <p className="-mt-3 truncate text-xs text-muted-foreground">
          {t("terms.variants", { list: term.variants.join(t("form.listJoin")) })}
        </p>
      ) : null}

      <Year items={items} unit={(count) => (count === 1 ? kindLabel.one(kind) : kindLabel.many(kind))} />

      {pending ? (
        <div className="grid gap-1">
          {Array.from({ length: Math.min(3, term.count) }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : (
        <ul className="grid">
          {items.slice(0, 3).map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <div className="mt-auto border-t pt-2.5">
        <Link
          to="/content/$kind"
          params={{ kind }}
          search={search}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
        >
          {t("terms.viewAll", { count: term.count, kind: unit })}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Year is how many of a category's items went out in each of the last twelve
 * months, as the dashboard draws the whole blog's. Empty months keep a stub,
 * so the year still reads as twelve.
 */
function Year({ items, unit }: { items: Item[]; unit: (count: number) => string }) {
  const { t, locale } = useI18n();
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  }, []);
  const counts = useMemo(
    () =>
      months.map((start) => {
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return items.filter((item) => {
          if (item.status !== "published" || !item.published_at) return false;
          const date = new Date(item.published_at);
          return date >= start && date < end;
        }).length;
      }),
    [items, months],
  );
  const peak = Math.max(1, ...counts);
  const long = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" });
  const first = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short" });
  const last = new Intl.DateTimeFormat(locale, { month: "short" });

  return (
    <div>
      <div className="grid h-[30px] grid-cols-12 items-end gap-[3px]">
        {counts.map((count, i) => (
          <span
            key={months[i].toISOString()}
            title={`${long.format(months[i])} · ${t("terms.countShort", { count, kind: unit(count) })}`}
            className={cn("rounded-[2px]", count ? "bg-primary" : "bg-muted")}
            style={{ height: count ? 8 + (count / peak) * 22 : 4 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{first.format(months[0])}</span>
        <span>{t("terms.lastYear")}</span>
        <span>{last.format(months[11])}</span>
      </div>
    </div>
  );
}

function TermMenu({
  term,
  url,
  kind,
  search,
  canMerge,
  onAction,
}: {
  term: string;
  url: string;
  kind: string;
  search: { terms: string[] };
  canMerge: boolean;
  onAction: TermProps["onAction"];
}) {
  const { t } = useI18n();
  const kindLabel = useKindLabel();
  const writable = useWritable();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="-me-2 ms-auto size-8 shrink-0 self-center p-0 text-muted-foreground data-[state=open]:bg-muted"
        >
          <DotsThreeIcon className="size-4" />
          <span className="sr-only">{t("list.actions")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to="/content/$kind" params={{ kind }} search={search}>
            <ListBulletsIcon />
            {t("terms.viewItems", { kind: kindLabel.many(kind) })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ArrowSquareOutIcon />
            {t("list.open")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!writable} onSelect={() => onAction({ mode: "rename", term })}>
          <PencilSimpleIcon />
          {t("terms.rename")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!writable || !canMerge} onSelect={() => onAction({ mode: "merge", term })}>
          <ArrowsMergeIcon />
          {t("terms.merge")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={!writable} onSelect={() => onAction({ mode: "remove", term })}>
          <TrashIcon />
          {t("terms.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
