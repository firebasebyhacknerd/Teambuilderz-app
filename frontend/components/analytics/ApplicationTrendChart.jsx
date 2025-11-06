import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatLabel = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ApplicationTrendChart = ({ data = [] }) => {
  const normalizedData = data.map((entry) => ({
    date:
      entry.date ||
      entry.day ||
      entry.bucket ||
      entry.label ||
      entry.date_label ||
      entry.activityDate ||
      '',
    total: Number(entry.totalApplications ?? entry.total ?? entry.count ?? 0),
    approved: Number(entry.approvedApplications ?? entry.approved ?? 0),
  }));

  if (!normalizedData.length) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No trend data available for this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={normalizedData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatLabel}
          minTickGap={24}
          stroke="#94A3B8"
          fontSize={12}
        />
        <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [
            Number(value).toLocaleString(),
            name === 'approved' ? 'Approved' : 'Logged',
          ]}
          labelFormatter={formatLabel}
          contentStyle={{
            borderRadius: '0.5rem',
            borderColor: '#E2E8F0',
            boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.1)',
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Logged"
          stroke="#6366F1"
          strokeWidth={2}
          fill="url(#colorTotal)"
        />
        <Area
          type="monotone"
          dataKey="approved"
          name="Approved"
          stroke="#10B981"
          strokeWidth={2}
          fill="url(#colorApproved)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default ApplicationTrendChart;
