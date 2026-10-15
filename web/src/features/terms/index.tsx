import { useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowSquareOutIcon, FolderIcon, MagnifyingGlassIcon, TagIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { useContentTypes, useTaxonomies, useTerms } from "@/hooks/useContents";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useKindLabel, useTaxonomyLabel } from "@/hooks/useKindLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/layout/app-header";
import { Main } from "@/components/layout/main";
import { PageTitle } from "@/components/layout/page-title";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { QueryError } from "@/components/query-error";
import { ReadOnlyNote } from "@/components/read-only-note";
import { TermDialog, type TermAction } from "./term-dialog";
import { CategoryCard } from "./category-card";
import { TagChip } from "./tag-chip";

type Order = "count" | "name";

const route = getRouteApi("/_authenticated/taxonomies/$taxonomy");

/**
 * Terms lists one taxonomy, as a blog's categories or tags page does. Terms
 * are gathered from the items that carry them, so there is nothing to add
 * here; renaming, merging or deleting one rewrites every item that carries
 * it. Terms with one slug are one term, named as most items write it.
 *
 * Categories are few and broad, so each is a card with its year and newest
 * items; any other taxonomy is a wall of chips, each opening its items.
 */
export function Terms() {
  const { taxonomy } = route.useParams();
  const { t, locale } = useI18n();
  const kindLabel = useKindLabel();
  const taxonomyLabel = useTaxonomyLabel();
  const types = useContentTypes();
  const taxonomies = useTaxonomies();
  const terms = useTerms(taxonomy);

  const url = taxonomies.data?.items.find((item) => item.name === taxonomy)?.url;
  // A term's items are listed under the first kind that carries the taxonomy.
  const kind =
    types.data?.items.find((type) => type.taxonomies?.includes(taxonomy))?.kind ?? "post";
  const name = taxonomyLabel(taxonomy);
  const many = kindLabel.many(kind);
  const cards = taxonomy === "categories";
  useDocumentTitle(name);

  const [action, setAction] = useState<TermAction | null>(null);
  const [order, setOrder] = useState<Order>("count");
  const [search, setSearch] = useState("");

  const all = useMemo(() => terms.data?.items ?? [], [terms.data]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // A term is found by any of the ways it is written.
    const found = needle
      ? all.filter((term) =>
          [term.term, ...(term.variants ?? [])].some((each) => each.toLowerCase().includes(needle)),
        )
      : all;
    return [...found].sort((a, b) =>
      order === "count"
        ? b.count - a.count || a.term.localeCompare(b.term, locale)
        : a.term.localeCompare(b.term, locale),
    );
  }, [all, search, order, locale]);

  const shared = { taxonomy, kind, canMerge: all.length > 1, onAction: setAction };

  return (
    <>
      <AppHeader />

      <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
        <PageTitle title={name} description={t("terms.description", { name, kind: many })}>
          {url && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ArrowSquareOutIcon />
                {t("terms.viewOnSite")}
              </a>
            </Button>
          )}
        </PageTitle>
        <ReadOnlyNote />

        {terms.error && !terms.data ? (
          <QueryError error={terms.error} onRetry={() => void terms.refetch()} />
        ) : terms.data && !all.length ? (
          <EmptyState
            icon={cards ? FolderIcon : TagIcon}
            title={t("terms.empty", { name })}
            note={t("terms.emptyNote", { name, kind: kindLabel.one(kind) })}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("terms.search", { name })}
                  aria-label={t("terms.search", { name })}
                  className="h-8 ps-8"
                />
              </div>
              <FilterChips
                label={t("terms.order")}
                value={order}
                onChange={setOrder}
                options={[
                  { value: "count", label: t("terms.byCount", { kind: many }) },
                  { value: "name", label: t("terms.byName") },
                ]}
              />
              {terms.data && (
                <span className="ms-auto text-sm text-muted-foreground tabular-nums">
                  {t("terms.total", { count: all.length, name })}
                </span>
              )}
            </div>

            {terms.isPending ? (
              cards ? (
                <div className={grid}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="h-8 w-20 rounded-[9px]" />
                  ))}
                </div>
              )
            ) : !shown.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("list.empty")}</p>
            ) : cards ? (
              <div className={grid}>
                {shown.map((term) => (
                  <CategoryCard key={term.term} term={term} {...shared} />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shown.map((term) => (
                  <TagChip key={term.term} term={term} {...shared} />
                ))}
              </div>
            )}
          </div>
        )}
      </Main>

      {action && (
        <TermDialog
          key={`${action.mode}:${action.term}`}
          taxonomy={taxonomy}
          terms={all}
          one={kindLabel.one(kind)}
          many={many}
          action={action}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}

// As many cards to a row as the column has room for, each wide enough for
// its newest titles.
const grid = "grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3.5";
