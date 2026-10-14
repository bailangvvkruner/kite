import { useEffect, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";

import type { Summary } from "@/api/client";
import { useI18n } from "@/i18n";
import { useTaxonomyLabel } from "@/hooks/useKindLabel";
import { followRowLink } from "@/lib/row-link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableBulkActions, DataTablePagination, DataTableToolbar } from "@/components/data-table";
import { termsOf, withTerms, type ContentSearch } from "../search";

function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

/** One of the tabs a listing is narrowed to a status by; no value is every status. */
export interface StatusTab {
  value?: string;
  label: string;
  count?: number;
}

interface Props {
  items: Summary[];
  loading: boolean;
  columns: ColumnDef<Summary>[];
  search: ContentSearch;
  onSearch: (patch: Partial<ContentSearch>) => void;
  /** sort is the order in force, the kind's default when the address has none. */
  sort: string;
  taxonomies: string[];
  /** statusTabs pick one status at a time; a trash listing has none. */
  statusTabs?: StatusTab[];
  termOptions: Record<string, { label: string; value: string; count: number }[]>;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  entityName: string;
  searchPlaceholder: string;
  /** bulkActions draws the buttons for what is selected. */
  bulkActions: (selected: Summary[]) => ReactNode;
  empty: ReactNode;
  pagination: Omit<Parameters<typeof DataTablePagination>[0], "className">;
}

/**
 * ContentsTable is shadcn-admin's data table over a listing the server pages,
 * sorts and filters. The table only shows; the address holds every choice.
 */
export function ContentsTable({
  items,
  loading,
  columns,
  search,
  onSearch,
  sort,
  taxonomies,
  statusTabs,
  termOptions,
  rowSelection,
  onRowSelectionChange,
  entityName,
  searchPlaceholder,
  bulkActions,
  empty,
  pagination,
}: Props) {
  const { t } = useI18n();
  const taxonomyLabel = useTaxonomyLabel();
  // The terms show under each title, so their own columns start folded away;
  // the view menu brings them back.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(taxonomies.map((taxonomy) => [taxonomy, false])),
  );

  // What is typed is shown at once and asked of the server once typing stops,
  // so a slow answer for an old prefix cannot replace a fresh one.
  const [query, setQuery] = useState(search.q ?? "");
  useEffect(() => setQuery(search.q ?? ""), [search.q]);
  useEffect(() => {
    if (query === (search.q ?? "")) return;
    const timer = setTimeout(() => onSearch({ q: query || undefined }), 300);
    return () => clearTimeout(timer);
  }, [query, search.q, onSearch]);

  const sorting: SortingState = sort ? [{ id: sort.replace(/^-/, ""), desc: sort.startsWith("-") }] : [];
  const columnFilters: ColumnFiltersState = [
    ...(search.status?.length ? [{ id: "status", value: search.status }] : []),
    ...taxonomies
      .map((taxonomy) => ({ id: taxonomy, value: termsOf(search.terms, taxonomy) }))
      .filter((filter) => filter.value.length > 0),
  ];

  const table = useReactTable({
    data: items,
    columns,
    getRowId: (item) => item.id,
    state: { sorting, columnFilters, globalFilter: query, rowSelection, columnVisibility },
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    enableRowSelection: true,
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const [first] = apply(updater, sorting);
      if (first) onSearch({ sort: `${first.desc ? "-" : ""}${first.id}` });
    },
    onColumnFiltersChange: (updater) => {
      const next = apply(updater, columnFilters);
      const chosen = (id: string) => {
        const value = next.find((filter) => filter.id === id)?.value;
        return Array.isArray(value) ? (value as string[]) : [];
      };
      let terms = search.terms;
      for (const taxonomy of taxonomies) terms = withTerms(terms, taxonomy, chosen(taxonomy));
      const status = chosen("status");
      onSearch({ status: status.length > 0 ? status : undefined, terms });
    },
    onGlobalFilterChange: (updater) => setQuery(String(apply(updater, query) ?? "")),
    onRowSelectionChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16', // Room for the bulk bar on a phone.
        "flex flex-1 flex-col gap-4",
      )}
    >
      {statusTabs && (
        <div role="group" aria-label={t("list.status")} className="flex flex-wrap gap-1.5">
          {statusTabs.map((tab) => {
            const on = tab.value
              ? search.status?.length === 1 && search.status[0] === tab.value
              : !search.status?.length;
            return (
              <button
                key={tab.value ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => onSearch({ status: tab.value ? [tab.value] : undefined })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors",
                  on ? "bg-foreground font-medium text-background" : "bg-muted text-foreground/80 hover:bg-accent",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <>
                    {" "}
                    <span className="tabular-nums opacity-70">{tab.count}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        filters={[
          ...taxonomies
            .filter((taxonomy) => termOptions[taxonomy]?.length)
            .map((taxonomy) => ({
              columnId: taxonomy,
              title: taxonomyLabel(taxonomy),
              options: termOptions[taxonomy],
            })),
        ]}
      />
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      "h-10 text-xs font-normal text-muted-foreground",
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length} className="py-3">
                    <Skeleton className="h-5 w-2/3" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={followRowLink}
                  className="has-[a[data-row-link]]:cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      data-row-skip={cell.column.columnDef.meta?.skipRowLink || undefined}
                      className={cn(
                        "py-2.5",
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination {...pagination} className="mt-auto" />
      <DataTableBulkActions table={table} entityName={entityName}>
        {bulkActions(selected)}
      </DataTableBulkActions>
    </div>
  );
}
