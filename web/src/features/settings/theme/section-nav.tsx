import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";

import type { Field } from "@/api/client";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KiteRoute } from "@/components/kite-route";

/** What a section holds that the list marks beside its name. */
export interface Flags {
  dirty: boolean;
  problem: boolean;
}

/** A setting a search found, and the section it is in. */
export interface Match {
  section: Field;
  field: Field;
}

interface Props {
  sections: Field[];
  current: string | undefined;
  flags: Record<string, Flags>;
  query: string;
  matches: Match[];
  onQuery: (query: string) => void;
  onChoose: (section: string) => void;
  onPick: (match: Match) => void;
  className?: string;
}

/**
 * SectionNav lists a theme's sections, one of which the form shows, and
 * finds a setting by its name when the theme has many.
 */
export function SectionNav({ sections, current, flags, query, matches, onQuery, onChoose, onPick, className }: Props) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("customize.sections")} className={cn("flex min-h-0 flex-col gap-3 p-3", className)}>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQuery("");
            if (event.key === "Enter" && matches[0]) onPick(matches[0]);
          }}
          placeholder={t("customize.search")}
          aria-label={t("customize.search")}
          className="h-8 ps-8 pe-7 text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 text-muted-foreground"
            aria-label={t("customize.clearSearch")}
            onClick={() => onQuery("")}
          >
            <XIcon />
          </Button>
        )}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {query ? (
          matches.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("customize.noMatch")}</p>
          ) : (
            <ul className="grid gap-0.5">
              {matches.map((match) => (
                <li key={`${match.section.key}.${match.field.key}`}>
                  <button
                    type="button"
                    onClick={() => onPick(match)}
                    className="w-full rounded-md px-2 py-1.5 text-start hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="block truncate text-sm">{match.field.label || match.field.key}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {match.section.label || match.section.key}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <KiteRoute
            label={t("customize.sections")}
            stops={sections.map((section) => ({
              key: section.key,
              title: section.label || section.key,
              changed: flags[section.key]?.dirty,
              problem: flags[section.key]?.problem,
            }))}
            current={sections.findIndex((section) => section.key === current)}
            onChoose={(i) => onChoose(sections[i].key)}
            className="px-1 pt-1"
          />
        )}
      </div>
    </nav>
  );
}

/** search finds the settings whose name or help mentions every word of a query. */
export function search(sections: Field[], fields: (section: Field) => Field[], query: string): Match[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return sections.flatMap((section) =>
    fields(section)
      .filter((field) => {
        const text = [field.label, field.help, field.key, section.label].filter(Boolean).join(" ").toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((field) => ({ section, field })),
  );
}
