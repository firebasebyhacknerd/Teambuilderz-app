import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Search, Calendar, User, Activity, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import toast from 'react-hot-toast';
import API_URL from '../lib/api';

/**
 * Audit Logs Component
 * Displays user activity and system actions
 */
const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    pages: 0,
  });

  // Fetch audit logs
  const fetchLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });

      const response = await fetch(`${API_URL}/api/v1/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'x-user-role': localStorage.getItem('userRole'),
        },
      });

      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      toast.error('Failed to fetch audit logs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs(0);
  }, []);

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const handleApplyFilters = () => {
    fetchLogs(0);
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      userId: '',
      action: '',
      resourceType: '',
      startDate: '',
      endDate: '',
    });
  };

  // Export logs
  const handleExport = async (format) => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });

      const response = await fetch(`${API_URL}/api/v1/audit/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'x-user-role': localStorage.getItem('userRole'),
        },
      });

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export logs');
      console.error(error);
    }
  };

  // Get action badge color
  const getActionColor = (action) => {
    const colors = {
      create: 'bg-emerald-100 text-emerald-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      view: 'bg-gray-100 text-gray-800',
      login: 'bg-purple-100 text-purple-800',
      logout: 'bg-amber-100 text-amber-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Track all user activities and system actions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* User ID */}
            <div>
              <Label className="text-sm">User ID</Label>
              <Input
                type="text"
                placeholder="Filter by user..."
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Action */}
            <div>
              <Label className="text-sm">Action</Label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-card text-sm"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="view">View</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
              </select>
            </div>

            {/* Resource Type */}
            <div>
              <Label className="text-sm">Resource Type</Label>
              <Input
                type="text"
                placeholder="Filter by resource..."
                value={filters.resourceType}
                onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Start Date */}
            <div>
              <Label className="text-sm">Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="mt-2"
              />
            </div>

            {/* End Date */}
            <div>
              <Label className="text-sm">End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} className="gap-2">
              <Search className="h-4 w-4" />
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="gap-2"
            >
              Clear All
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="p-6 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No audit logs found
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Time</th>
                  <th className="text-left py-3 px-4 font-semibold">User</th>
                  <th className="text-left py-3 px-4 font-semibold">Action</th>
                  <th className="text-left py-3 px-4 font-semibold">Resource</th>
                  <th className="text-left py-3 px-4 font-semibold">IP Address</th>
                  <th className="text-left py-3 px-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(log.created_at)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {log.user_id}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <div className="font-medium">{log.resource_type}</div>
                        <div className="text-xs text-muted-foreground">ID: {log.resource_id}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {log.ip_address}
                    </td>
                    <td className="py-3 px-4">
                      <details className="cursor-pointer">
                        <summary className="text-primary hover:underline">View</summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} to{' '}
                  {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                  {pagination.total} logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchLogs(pagination.offset + pagination.limit)}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;
