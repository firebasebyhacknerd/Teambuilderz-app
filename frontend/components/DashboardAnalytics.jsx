import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, CheckCircle, Clock, Target } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

/**
 * Dashboard Analytics Component
 * Displays recruitment metrics and analytics
 */
const DashboardAnalytics = ({ data = {} }) => {
  const {
    recruiters = [],
    candidates = [],
    applications = [],
    dateRange = { start: null, end: null },
  } = data;

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCandidates = candidates.length;
    const totalApplications = applications.length;
    const approvedApplications = applications.filter((a) => a.status === 'hired').length;
    const conversionRate = totalApplications > 0 ? ((approvedApplications / totalApplications) * 100).toFixed(1) : 0;

    // Recruiter performance
    const recruiterMetrics = recruiters.map((recruiter) => {
      const recruiterCandidates = candidates.filter((c) => c.assigned_recruiter_id === recruiter.id);
      const recruiterApplications = applications.filter((a) => a.recruiter_id === recruiter.id);
      const recruiterApproved = recruiterApplications.filter((a) => a.status === 'hired').length;

      return {
        name: recruiter.name,
        candidates: recruiterCandidates.length,
        applications: recruiterApplications.length,
        approved: recruiterApproved,
        rate: recruiterApplications.length > 0
          ? ((recruiterApproved / recruiterApplications.length) * 100).toFixed(1)
          : 0,
      };
    });

    // Stage distribution
    const stageDistribution = [
      { name: 'Onboarding', value: candidates.filter((c) => c.current_stage === 'onboarding').length },
      { name: 'Marketing', value: candidates.filter((c) => c.current_stage === 'marketing').length },
      { name: 'Interviewing', value: candidates.filter((c) => c.current_stage === 'interviewing').length },
      { name: 'Offered', value: candidates.filter((c) => c.current_stage === 'offered').length },
      { name: 'Placed', value: candidates.filter((c) => c.current_stage === 'placed').length },
    ];

    // Application status distribution
    const statusDistribution = [
      { name: 'Sent', value: applications.filter((a) => a.status === 'sent').length },
      { name: 'Viewed', value: applications.filter((a) => a.status === 'viewed').length },
      { name: 'Shortlisted', value: applications.filter((a) => a.status === 'shortlisted').length },
      { name: 'Interviewing', value: applications.filter((a) => a.status === 'interviewing').length },
      { name: 'Offered', value: applications.filter((a) => a.status === 'offered').length },
      { name: 'Hired', value: applications.filter((a) => a.status === 'hired').length },
      { name: 'Rejected', value: applications.filter((a) => a.status === 'rejected').length },
    ];

    return {
      totalCandidates,
      totalApplications,
      approvedApplications,
      conversionRate,
      recruiterMetrics,
      stageDistribution,
      statusDistribution,
    };
  }, [recruiters, candidates, applications]);

  const COLORS = ['#3b82f6', '#fbbf24', '#a855f7', '#f97316', '#10b981', '#ef4444', '#6366f1'];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Key Metrics */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" variants={itemVariants}>
        {/* Total Candidates */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Candidates</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{metrics.totalCandidates}</p>
            </div>
            <Users className="h-12 w-12 text-blue-300 opacity-50" />
          </div>
        </Card>

        {/* Total Applications */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Total Applications</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">{metrics.totalApplications}</p>
            </div>
            <Target className="h-12 w-12 text-purple-300 opacity-50" />
          </div>
        </Card>

        {/* Approved Applications */}
        <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Approved</p>
              <p className="text-3xl font-bold text-emerald-900 mt-2">{metrics.approvedApplications}</p>
            </div>
            <CheckCircle className="h-12 w-12 text-emerald-300 opacity-50" />
          </div>
        </Card>

        {/* Conversion Rate */}
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 font-medium">Conversion Rate</p>
              <p className="text-3xl font-bold text-amber-900 mt-2">{metrics.conversionRate}%</p>
            </div>
            <TrendingUp className="h-12 w-12 text-amber-300 opacity-50" />
          </div>
        </Card>
      </motion.div>

      {/* Charts */}
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" variants={itemVariants}>
        {/* Recruiter Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recruiter Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.recruiterMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#3b82f6" name="Applications" />
              <Bar dataKey="approved" fill="#10b981" name="Approved" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Stage Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Candidate Stage Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.stageDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {metrics.stageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Application Status Distribution */}
      <motion.div variants={itemVariants}>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Application Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.statusDistribution} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Recruiter Metrics Table */}
      <motion.div variants={itemVariants}>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recruiter Metrics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Recruiter</th>
                  <th className="text-center py-3 px-4 font-semibold">Candidates</th>
                  <th className="text-center py-3 px-4 font-semibold">Applications</th>
                  <th className="text-center py-3 px-4 font-semibold">Approved</th>
                  <th className="text-center py-3 px-4 font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.recruiterMetrics.map((recruiter, idx) => (
                  <tr key={idx} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{recruiter.name}</td>
                    <td className="py-3 px-4 text-center">{recruiter.candidates}</td>
                    <td className="py-3 px-4 text-center">{recruiter.applications}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-emerald-100 text-emerald-800">{recruiter.approved}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-blue-100 text-blue-800">{recruiter.rate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default DashboardAnalytics;
