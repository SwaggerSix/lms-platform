"use client";

import React, { useMemo, useState } from "react";
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
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = useState<string | null>(
    initialSort ? initialSort.replace(/^-/, "") : null
  );
  const [sortDesc, setSortDesc] = useState(initialSort?.startsWith("-") ?? false);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
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
  }, [rows, columns, sortKey, sortDesc]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pageRows =
    pageSize > 0
      ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : sorted;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
    setPage(1);
  };

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
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              return (
                <TableHead
                  key={column.key}
                  className={column.className}
                  aria-sort={
                    column.sortValue
                      ? isSorted
                        ? sortDesc
                          ? "descending"
                          : "ascending"
                        : "none"
                      : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
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
          {pageRows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {pageRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-gray-500">
                No matching results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageSize > 0 && totalPages > 1 && (
        <nav
          aria-label="Table pagination"
          className="flex items-center justify-between border-t border-gray-200 px-4 py-3"
        >
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
