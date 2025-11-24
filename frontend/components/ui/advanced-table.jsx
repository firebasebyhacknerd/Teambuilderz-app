import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  Download,
  Trash2,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from './button';
import { Checkbox } from './checkbox';

/**
 * Advanced Table Component with sorting, pagination, and selection
 * 
 * Usage:
 * <AdvancedTable
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true },
 *     { key: 'email', label: 'Email', sortable: true },
 *   ]}
 *   data={data}
 *   onRowClick={(row) => console.log(row)}
 *   onBulkAction={(action, selectedRows) => console.log(action, selectedRows)}
 * />
 */
const AdvancedTable = ({
  columns = [],
  data = [],
  onRowClick = null,
  onBulkAction = null,
  pageSize = 10,
  className = '',
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Handle sorting
  const handleSort = (columnKey) => {
    setSortConfig((prev) => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [data, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle row selection
  const handleSelectRow = (rowId) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      const allIds = new Set(paginatedData.map((_, idx) => idx));
      setSelectedRows(allIds);
    }
  };

  // Render cell content
  const renderCell = (row, column) => {
    const value = row[column.key];

    if (column.render) {
      return column.render(value, row);
    }

    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    return value ?? '—';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg"
        >
          <span className="text-sm font-medium text-foreground">
            {selectedRows.size} selected
          </span>
          {onBulkAction && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onBulkAction('export', Array.from(selectedRows))}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onBulkAction('delete', Array.from(selectedRows))}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedRows(new Set())}
          >
            Clear
          </Button>
        </motion.div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          {/* Header */}
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {/* Select All Checkbox */}
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                  onChange={handleSelectAll}
                />
              </th>

              {/* Column Headers */}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left font-semibold text-foreground"
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      {column.label}
                      {sortConfig.key === column.key && (
                        sortConfig.direction === 'asc' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}

              {/* Actions Column */}
              <th className="px-4 py-3 text-right font-semibold text-foreground">
                Actions
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-border">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-muted-foreground">
                  No data available
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedRows.has(idx)}
                      onChange={() => handleSelectRow(idx)}
                    />
                  </td>

                  {/* Cells */}
                  {columns.map((column) => (
                    <td
                      key={`${idx}-${column.key}`}
                      className="px-4 py-3 text-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onRowClick?.(row)}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="min-w-10"
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedTable;
