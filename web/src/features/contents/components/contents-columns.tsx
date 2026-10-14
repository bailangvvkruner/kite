import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { PushPinIcon } from "@phosphor-icons/react";

import type { Summary } from "@/api/client";
import { useI18n } from "@/i18n";
import { useTaxonomyLabel } from "@/hooks/useKindLabel";
import { isoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/data-table";
import { StatusPill } from "@/components/StatusLabel";
import { RowActions } from "./row-actions";

interface Options {
  /** The fields the kind can be sorted by. */
  sortable: string[];
  taxonomies: string[];
  trashed: boolean;
  /** writable is whether the server takes changes, which is all selecting rows is for. */
  writable: boolean;
  chosenTerms: (taxonomy: string) => string[];
  onTerm: (taxonomy: string, term: string) => void;
  onDelete: (item: Summary) => void;
  onRestore: (item: Summary) => void;
}

/** useContentsColumns lays out a listing: one column per taxonomy the kind has. */
export function useContentsColumns({
  sortable,
  taxonomies,
  trashed,
  writable,
  chosenTerms,
  onTerm,
  onDelete,
  onRestore,
}: Options): ColumnDef<Summary>[] {
  const { t } = useI18n();
  const taxonomyLabel = useTaxonomyLabel();

  return useMemo<ColumnDef<Summary>[]>(
    () => {
      const columns: ColumnDef<Summary>[] = [
        {
          id: "select",
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label={t("list.selectAll")}
              className="translate-y-[2px]"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={row.original.title || row.original.slug}
              className="translate-y-[2px]"
            />
          ),
          enableSorting: false,
          enableHiding: false,
          meta: { className: "w-10", skipRowLink: true },
        },
        {
          id: "title",
          accessorKey: "title",
          header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.title")} />,
          cell: ({ row }) => {
            const item = row.original;
            const name = item.title || item.slug;
            const sorts = taxonomies.filter((taxonomy) => item.taxonomies?.[taxonomy]?.length);
            return (
              // A clamp rather than truncate lets a long title give way on a narrow screen.
              <div className="max-w-[36rem] min-w-0 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  {trashed ? (
                    <span className="line-clamp-1 font-medium whitespace-normal wrap-anywhere">{name}</span>
                  ) : (
                    <Link
                      to="/content/$kind/$id"
                      params={{ kind: item.kind, id: item.id }}
                      data-row-link
                      className="line-clamp-1 font-medium whitespace-normal wrap-anywhere hover:underline"
                    >
                      {name}
                    </Link>
                  )}
                  {item.pinned && (
                    <PushPinIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("field.pinned")} />
                  )}
                </div>
                {/* What the item is filed under, each term a filter: categories by
                    name, tags with a hash, as the dashboard writes them. */}
                {sorts.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {sorts.map((taxonomy, i) => (
                      <span key={taxonomy} className="flex flex-wrap items-center gap-x-1.5">
                        {i > 0 && <span aria-hidden>·</span>}
                        {(item.taxonomies?.[taxonomy] ?? []).map((term) => (
                          <button
                            key={term}
                            type="button"
                            title={taxonomyLabel(taxonomy)}
                            onClick={() => onTerm(taxonomy, term)}
                            className={cn(
                              "hover:text-foreground",
                              chosenTerms(taxonomy).includes(term) && "font-medium text-primary",
                            )}
                          >
                            {taxonomy === "tags" ? `#${term}` : term}
                          </button>
                        ))}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          },
          enableSorting: sortable.includes("title"),
          enableHiding: false,
          meta: { title: t("list.title") },
        },
        ...taxonomies.map(
          (taxonomy): ColumnDef<Summary> => ({
            id: taxonomy,
            accessorFn: (item) => item.taxonomies?.[taxonomy] ?? [],
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title={taxonomyLabel(taxonomy)} />
            ),
            cell: ({ row }) => {
              const terms = row.original.taxonomies?.[taxonomy] ?? [];
              const chosen = chosenTerms(taxonomy);
              return (
                <div className="flex max-w-56 flex-wrap gap-1">
                  {terms.map((term) => (
                    <button key={term} type="button" onClick={() => onTerm(taxonomy, term)}>
                      <Badge
                        variant={chosen.includes(term) ? "default" : "secondary"}
                        className="max-w-40 truncate font-normal"
                      >
                        {term}
                      </Badge>
                    </button>
                  ))}
                </div>
              );
            },
            enableSorting: false,
            meta: { title: taxonomyLabel(taxonomy) },
          }),
        ),
        {
          id: "status",
          accessorKey: "status",
          header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.status")} />,
          cell: ({ row }) => <StatusPill status={row.original.status} />,
          enableSorting: false,
          meta: { title: t("list.status") },
        },
        ...(["published_at", "updated_at"] as const).map(
          (field): ColumnDef<Summary> => ({
            id: field,
            accessorKey: field,
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t(field === "published_at" ? "list.publishedAt" : "list.updatedAt")}
              />
            ),
            cell: ({ row }) => {
              const item = row.original;
              if (field === "updated_at") {
                // An item that records no time shows when its file last changed.
                return (
                  <span className="text-muted-foreground tabular-nums">
                    {isoDate(item.updated_at ?? item.modified_at)}
                  </span>
                );
              }
              // Published without a date is missing something; a draft is not.
              if (!item.published_at && item.status === "published") {
                return <span className="text-muted-foreground">{t("list.noDate")}</span>;
              }
              return (
                <span className="text-muted-foreground tabular-nums">{isoDate(item.published_at)}</span>
              );
            },
            enableSorting: sortable.includes(field),
            meta: {
              title: t(field === "published_at" ? "list.publishedAt" : "list.updatedAt"),
              className: field === "updated_at" ? "hidden xl:table-cell" : "hidden sm:table-cell",
            },
          }),
        ),
        {
          id: "actions",
          cell: ({ row }) => (
            <RowActions
              item={row.original}
              trashed={trashed}
              writable={writable}
              onDelete={onDelete}
              onRestore={onRestore}
            />
          ),
          enableSorting: false,
          enableHiding: false,
          meta: { className: "w-10", skipRowLink: true },
        },
      ];
      return writable ? columns : columns.filter((column) => column.id !== "select");
    },
    [t, taxonomyLabel, sortable, taxonomies, trashed, writable, chosenTerms, onTerm, onDelete, onRestore],
  );
}
