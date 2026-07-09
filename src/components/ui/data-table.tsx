"use client";

import React, { Fragment, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./table";
import { EmptyState } from "./empty-state";
import { Button } from "./button";

export interface DataTableColumn<Row> {
  /** Unique key for the column. Used for sort state. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. */
  render: (row: Row) => React.ReactNode;
  /** Provide to make the column sortable (returns the comparable value). */
  sortValue?: (row: Row) => string | number | null;
  /** Extra classes for both the header and body cells (e.g. text-right, hidden sm:table-cell). */
  className?: string;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Rows per page. Set to 0 to disable pagination. Default 25. */
  pageSize?: number;
  /** Initial sort: column key, prefixed with "-" for descending (e.g. "-created"). */
  initialSort?: string;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  /** Accessible label for the table. */
  ariaLabel?: string;
  className?: string;
  /**
   * Render a full-width detail panel below a row. Providing this adds a
   * leading expand-toggle column; the panel spans every column when open.
   */
  renderExpanded?: (row: Row) => React.ReactNode;
  /** With renderExpanded: rows for which this returns false get no toggle. Defaults to every row expandable. */
  isExpandable?: (row: Row) => boolean;
  /** Extra classes for a body row (e.g. dim resolved/inactive rows). */
  rowClassName?: (row: Row) => string | undefined;
  /**
   * Opt in to server-driven paging/sorting. When set, `rows` is treated as
   * the current page exactly as given — no client slicing or sorting — and
   * the footer pager reports `total`/`page` and calls `onPageChange`. Sort
   * headers become controlled: they reflect `sort` ("field" / "-field") and
   * call `onSortChange(key)` instead of sorting in the browser. Provide
   * `onSortChange` to keep columns interactive; omit it for static headers.
   */
  serverMode?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    sort?: string | null;
    onSortChange?: (key: string) => void;
  };
}

/**
 * Standard list table: accessible sortable headers (real buttons with
 * aria-sort), client-side pagination, and a built-in EmptyState. For
 * datasets small enough to ship to the client; server-driven lists should
 * keep their own pagination and can still use the Table primitives.
 */
export default function DataTable<Row>({
  columns,
  rows,
  rowKey,
  pageSize = 25,
  initialSort,
  emptyState,
  ariaLabel,
  className,
  renderExpanded,
  isExpandable,
  rowClassName,
  serverMode,
}: DataTableProps<Row>) {
  const [clientSortKey, setClientSortKey] = useState<string | null>(
    initialSort ? initialSort.replace(/^-/, "") : null
  );
  const [clientSortDesc, setClientSortDesc] = useState(initialSort?.startsWith("-") ?? false);
  const [clientPage, setClientPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // In server mode, sort state is controlled by the parent via `serverMode`.
  const sortKey = serverMode
    ? serverMode.sort
      ? serverMode.sort.replace(/^-/, "")
      : null
    : clientSortKey;
  const sortDesc = serverMode
    ? serverMode.sort?.startsWith("-") ?? false
    : clientSortDesc;

  const colCount = columns.length + (renderExpanded ? 1 : 0);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Client-side sort only applies when NOT in server mode (the server has
  // already sorted the given page).
  const sorted = useMemo(() => {
    if (serverMode || !sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    const getValue = column.sortValue;
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
  }, [serverMode, rows, columns, sortKey, sortDesc]);

  const serverPageSize = serverMode?.pageSize ?? pageSize;
  const totalItems = serverMode ? serverMode.total : sorted.length;
  const totalPages =
    serverMode
      ? Math.max(1, Math.ceil(serverMode.total / (serverMode.pageSize || 1)))
      : pageSize > 0
        ? Math.max(1, Math.ceil(sorted.length / pageSize))
        : 1;
  const currentPage = serverMode ? serverMode.page : Math.min(clientPage, totalPages);
  // In server mode the given rows already ARE the current page.
  const pageRows = serverMode
    ? rows
    : pageSize > 0
      ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : sorted;
  const showPager = serverMode ? totalPages > 1 : pageSize > 0 && totalPages > 1;

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    if (serverMode) serverMode.onPageChange(clamped);
    else setClientPage(clamped);
  };

  const handleSort = (key: string) => {
    if (serverMode) {
      serverMode.onSortChange?.(key);
      return;
    }
    if (sortKey === key) {
      setClientSortDesc((d) => !d);
    } else {
      setClientSortKey(key);
      setClientSortDesc(false);
    }
    setClientPage(1);
  };

  // A sort header is interactive when the column is sortable AND (client mode
  // OR the parent supplied a server sort handler).
  const sortInteractive = (column: DataTableColumn<Row>) =>
    !!column.sortValue && (!serverMode || !!serverMode.onSortChange);

  if (rows.length === 0 && emptyState) {
    return (
      <EmptyState
        icon={emptyState.icon ?? <Inbox className="h-10 w-10" aria-hidden="true" />}
        title={emptyState.title}
        description={emptyState.description}
        action={emptyState.action}
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-200 bg-white", className)}>
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow className="hover:bg-gray-50">
            {renderExpanded && (
              <TableHead className="w-8">
                <span className="sr-only">Expand</span>
              </TableHead>
            )}
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const interactive = sortInteractive(column);
              return (
                <TableHead
                  key={column.key}
                  className={column.className}
                  aria-sort={
                    interactive
                      ? isSorted
                        ? sortDesc
                          ? "descending"
                          : "ascending"
                        : "none"
                      : undefined
                  }
                >
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      {column.header}
                      {isSorted ? (
                        sortDesc ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => {
            const key = rowKey(row);
            const expandable = renderExpanded ? isExpandable?.(row) ?? true : false;
            const isOpen = expandable && expandedKeys.has(key);
            return (
              <Fragment key={key}>
                <TableRow className={rowClassName?.(row)}>
                  {renderExpanded && (
                    <TableCell className="w-8">
                      {expandable && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={isOpen}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          <span className="sr-only">{isOpen ? "Collapse row" : "Expand row"}</span>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
                {isOpen && renderExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colCount} className="bg-gray-50/50 px-6 py-4">
                      {renderExpanded(row)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {pageRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} className="py-8 text-center text-gray-500">
                No matching results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {showPager && (
        <nav
          aria-label="Table pagination"
          className="flex items-center justify-between border-t border-gray-200 px-4 py-3"
        >
          <p className="text-sm text-gray-500">
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * serverPageSize + 1}–
            {Math.min(currentPage * serverPageSize, totalItems)} of {totalItems}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
