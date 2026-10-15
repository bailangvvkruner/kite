import { useMemo } from "react";
import { Link } from "@tanstack/react-router";

import type { components } from "@/api/client";
import { useDates } from "@/lib/dates";
import { useTerm } from "@/hooks/useTerm";
import { StatusPill } from "@/components/StatusLabel";
import type { TermMode } from "./term-dialog";

export type Term = components["schemas"]["TermCount"];
type Item = components["schemas"]["TermItem"];

/** What a category card and a tag chip are given. */
export interface TermProps {
  term: Term;
  taxonomy: string;
  /** The kind whose list a term opens. */
  kind: string;
  canMerge: boolean;
  onAction: (action: { mode: TermMode; term: string }) => void;
}

/** itemDate is when an item went out, or else when it last changed. */
export function itemDate(item: Item): string | undefined {
  return item.published_at ?? item.updated_at ?? item.modified_at ?? item.created_at;
}

/**
 * useTermItems reads the items carrying a term, newest first. Trashed items
 * still carry it, so a change to the term rewrites them, but they are not
 * shown as its items.
 */
export function useTermItems(taxonomy: string, term: string) {
  const detail = useTerm(taxonomy, term);
  const items = useMemo(
    () =>
      (detail.data?.items ?? [])
        .filter((item) => !item.trashed)
        .sort((a, b) => (itemDate(b) ?? "").localeCompare(itemDate(a) ?? "")),
    [detail.data],
  );
  return { items, pending: detail.isPending, error: detail.error };
}

/** ItemRow is one item under a term, opening it in the editor. */
export function ItemRow({ item, className }: { item: Item; className?: string }) {
  const dates = useDates();
  const date = itemDate(item);
  return (
    <li className={className}>
      <Link
        to="/content/$kind/$id"
        params={{ kind: item.kind, id: item.id }}
        className="-mx-2 flex h-8 items-center gap-2 rounded-md px-2 text-[13.5px] outline-none hover:bg-muted/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="min-w-0 truncate">{item.title || item.slug}</span>
        {item.status !== "published" && (
          <StatusPill status={item.status} className="h-5 shrink-0 px-1.5 text-[11px]" />
        )}
        <span title={dates.full(date)} className="ms-auto shrink-0 ps-2 text-xs text-muted-foreground tabular-nums">
          {date ? dates.day(date) : ""}
        </span>
      </Link>
    </li>
  );
}
