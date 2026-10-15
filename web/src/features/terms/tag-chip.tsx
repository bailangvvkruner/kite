import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowSquareOutIcon,
  ArrowsMergeIcon,
  ListBulletsIcon,
  PencilSimpleIcon,
  TrashIcon,
  type Icon,
} from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { useWritable } from "@/hooks/useContents";
import { useKindLabel } from "@/hooks/useKindLabel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TermMode } from "./term-dialog";
import { ItemRow, useTermItems, type TermProps } from "./term-parts";

// A tag's card lists this many of its newest items, then how many more.
const PEEK = 6;

/**
 * TagChip is one tag on the wall: its name and how many items carry it. A
 * click opens a card with those items and the changes to the tag, read only
 * once the card opens.
 */
export function TagChip(props: TermProps) {
  const { term, onAction } = props;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-2 rounded-[9px] border border-input border-b-input-edge bg-card ps-3 pe-[5px] text-[13.5px] shadow-xs transition-[border-color,box-shadow] outline-none hover:border-input-edge focus-visible:ring-[3px] focus-visible:ring-field-ring data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-field-ring"
        >
          {term.term}
          <span className="grid h-[22px] min-w-[22px] place-items-center rounded-md bg-muted px-1.5 text-[11.5px] text-muted-foreground tabular-nums">
            {term.count}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3.5 outline-none"
        tabIndex={-1}
        // Focus lands on the card rather than its first button, whose hint
        // would otherwise open with it; Tab still walks into the card.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <TagCard
          {...props}
          onAction={(action) => {
            setOpen(false);
            onAction(action);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function TagCard({ term, taxonomy, kind, canMerge, onAction }: TermProps) {
  const { t } = useI18n();
  const kindLabel = useKindLabel();
  const writable = useWritable();
  const { items, pending } = useTermItems(taxonomy, term.term);
  const search = { terms: [`${taxonomy}:${term.term}`] };
  const more = items.length - PEEK;
  const act = (mode: TermMode) => onAction({ mode, term: term.term });

  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate font-serif text-lg leading-snug font-bold">
          <span className="me-0.5 font-sans font-normal text-muted-foreground">#</span>
          {term.term}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t("terms.countLong", {
            count: term.count,
            kind: term.count === 1 ? kindLabel.one(kind) : kindLabel.many(kind),
          })}
        </span>
      </div>
      {term.variants?.length ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("terms.variants", { list: term.variants.join(t("form.listJoin")) })}
        </p>
      ) : null}

      {pending ? (
        <div className="grid gap-1">
          {Array.from({ length: Math.min(PEEK, term.count) }, (_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : (
        <ul className="grid">
          {items.slice(0, PEEK).map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <Link
          to="/content/$kind"
          params={{ kind }}
          search={search}
          className="-mt-2 text-xs text-primary hover:underline"
        >
          {t("terms.more", { count: more })}
        </Link>
      )}

      <div className="flex items-center gap-0.5 border-t pt-2">
        <Button variant="ghost" size="sm" asChild className="-ms-2 text-muted-foreground">
          <Link to="/content/$kind" params={{ kind }} search={search}>
            <ListBulletsIcon />
            {t("terms.viewItems", { kind: kindLabel.many(kind) })}
          </Link>
        </Button>
        <span className="flex-1" />
        <Action icon={PencilSimpleIcon} label={t("terms.rename")} disabled={!writable} onClick={() => act("rename")} />
        <Action
          icon={ArrowsMergeIcon}
          label={t("terms.merge")}
          disabled={!writable || !canMerge}
          onClick={() => act("merge")}
        />
        <Action icon={ArrowSquareOutIcon} label={t("list.open")} href={term.url} />
        <Action icon={TrashIcon} label={t("terms.remove")} danger disabled={!writable} onClick={() => act("remove")} />
      </div>
    </div>
  );
}

/** Action is one icon button on a tag's card, named by its hint. */
function Action({
  icon: Glyph,
  label,
  href,
  danger,
  disabled,
  onClick,
}: {
  icon: Icon;
  label: string;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const look = cn(
    "size-8 text-muted-foreground",
    danger && "hover:bg-destructive/10 hover:text-destructive",
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button variant="ghost" size="icon" asChild className={look}>
            <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
              <Glyph />
            </a>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={look}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            <Glyph />
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
