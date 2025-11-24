import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import {
  FileText,
  Filter,
  Home,
  LogOut,
  Users,
  AlertTriangle,
  TrendingUp,
  CircleUser,
  Edit,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LogApplicationModal from '../../components/LogApplicationModal';
import API_URL from '../../lib/api';
import { track } from '../../lib/analytics';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import EmptyState from '../../components/ui/empty-state';
import PDFExportButton from '../../components/ui/pdf-export-button';
import {
  useApplicationsQuery,
  useInterviewsQuery,
  useAssessmentsQuery,
  useUpdateApplicationMutation,
  useApproveApplicationMutation,
  useDeleteApplicationMutation,
} from '../../lib/queryHooks';
import { formatDate, formatDateTime, formatLabel } from '../../lib/formatting';

const STATUS_OPTIONS = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];
const STATUS_DETAILS = {
  sent: { label: 'Sent', tone: 'border border-slate-200 bg-slate-100 text-slate-700', bar: 'bg-slate-400' },
  viewed: { label: 'Viewed', tone: 'border border-sky-200 bg-sky-100 text-sky-700', bar: 'bg-sky-400' },
  shortlisted: { label: 'Shortlisted', tone: 'border border-indigo-200 bg-indigo-100 text-indigo-700', bar: 'bg-indigo-400' },
  interviewing: { label: 'Interviewing', tone: 'border border-purple-200 bg-purple-100 text-purple-700', bar: 'bg-purple-400' },
  offered: { label: 'Offered', tone: 'border border-amber-200 bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  hired: { label: 'Hired', tone: 'border border-emerald-200 bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  rejected: { label: 'Rejected', tone: 'border border-rose-200 bg-rose-100 text-rose-700', bar: 'bg-rose-400' },
};

const LOG_STEPS = [
  {
    label: 'Step 1',
    title: 'Basics',
    description: 'Capture candidate, volume, and quota rationale.',
  },
  {
    label: 'Step 2',
    title: 'Interviews',
    description: 'Optionally schedule upcoming conversations.',
  },
  {
    label: 'Step 3',
    title: 'Assessments',
    description: 'Log assignments, platforms, and due dates.',
  },
];

const ApplicationsPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userName, setUserName] = useState('Recruiter');
  const [userRole, setUserRole] = useState('Recruiter');
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [editingApplicationsCount, setEditingApplicationsCount] = useState('');
  const [editMessage, setEditMessage] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    const storedRole = localStorage.getItem('userRole') || 'Recruiter';
    const storedName = localStorage.getItem('userName');
    setUserRole(storedRole);
    if (storedName) setUserName(storedName);
  }, [router]);

  const {
    data: applications = [],
    isLoading: applicationsLoading,
    isRefetching: applicationsRefetching,
  } = useApplicationsQuery(token);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const interviewQueryParams = useMemo(
    () => ({ date_from: today, status: 'scheduled' }),
    [today],
  );

  const assessmentQueryParams = useMemo(
    () => ({ status: 'assigned' }),
    [],
  );

  const {
    data: interviews = [],
    isLoading: interviewsLoading,
    isRefetching: interviewsRefetching,
  } = useInterviewsQuery(token, interviewQueryParams, Boolean(token));

  const {
    data: assessments = [],
    isLoading: assessmentsLoading,
    isRefetching: assessmentsRefetching,
  } = useAssessmentsQuery(token, assessmentQueryParams, Boolean(token));

  const dailyTarget = 60;

  const todaysTotals = useMemo(() => {
    if (!applications?.length) {
      return { total: 0, records: 0 };
    }

    return applications.reduce(
      (acc, application) => {
        const applicationDate = application.application_date
          ? new Date(application.application_date).toISOString().split('T')[0]
          : null;

        if (applicationDate === today) {
          acc.total += Number(application.applications_count) || 0;
          acc.records += 1;
        }

        return acc;
      },
      { total: 0, records: 0 },
    );
  }, [applications, today]);

  const progressPercent = dailyTarget
    ? Math.min(100, Math.round((todaysTotals.total / dailyTarget) * 100))
    : 0;
  const remainingToTarget = Math.max(0, dailyTarget - todaysTotals.total);

  const updateApplication = useUpdateApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application updated successfully.' });
      setEditingApplicationId(null);
      setEditingApplicationsCount('');
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to update application.',
      });
    },
  });

  const approveApplication = useApproveApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application approval updated.' });
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to update approval.',
      });
    },
  });

  const deleteApplication = useDeleteApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application rejected and removed.' });
      if (editingApplicationId) {
        setEditingApplicationId(null);
        setEditingApplicationsCount('');
      }
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to reject application.',
      });
    },
  });

  const filteredApplications = useMemo(() => {
    const lowered = searchTerm.trim().toLowerCase();

    return applications.filter((app) => {
      const textMatches =
        !lowered ||
        [app.candidate_name, app.company_name, app.job_title, app.channel, app.status]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(lowered));

      const statusMatches = !statusFilter || app.status === statusFilter;
      return textMatches && statusMatches;
    });
  }, [applications, searchTerm, statusFilter]);

  const filteredApprovalSummary = useMemo(() => {
    return filteredApplications.reduce(
      (acc, app) => {
        const count = Number(app.applications_count) || 0;
        acc.total += count;
        if (app.is_approved) {
          acc.approved += count;
          acc.approvedRecords += 1;
        } else {
          acc.pending += count;
          acc.pendingRecords += 1;
        }
        return acc;
      },
      { total: 0, approved: 0, pending: 0, approvedRecords: 0, pendingRecords: 0 }
    );
  }, [filteredApplications]);

  const statusSummary = useMemo(() => {
    const base = STATUS_OPTIONS.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    applications.forEach((app) => {
      const statusKey = STATUS_OPTIONS.includes(app.status) ? app.status : 'sent';
      base[statusKey] = (base[statusKey] || 0) + 1;
    });

    return base;
  }, [applications]);

  const statusSummaryTotal = useMemo(
    () => STATUS_OPTIONS.reduce((total, status) => total + (statusSummary[status] ?? 0), 0),
    [statusSummary],
  );

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Admin') {
      return [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/candidates', label: 'Candidates', icon: Users },
        { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
        { href: '/recruiter/applications', label: 'Applications', icon: FileText },
        { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
        { href: '/profile', label: 'My Profile', icon: CircleUser },
      ];
    }

    return [
      { href: '/recruiter', label: 'Dashboard', icon: Home },
      { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ];
  }, [userRole]);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      toast.success('Logged out successfully');
    } catch (logoutError) {
      console.warn('Failed to log out cleanly', logoutError);
      toast.error('Logout failed, but clearing local session');
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const goToCandidate = (candidateId) => {
    if (!candidateId) return;
    router.push(`/recruiter/candidate/${candidateId}`);
  };

  const goToRecruiterProfile = (userId) => {
    if (!userId) return;
    router.push(`/recruiter/profile/${userId}`);
  };

  const handleApplicationLogged = useCallback(() => {
    track('recruiter_application_logged_modal');
  }, []);

  useEffect(() => {
    if (expandedRowId && !applications.some((app) => app.id === expandedRowId)) {
      setExpandedRowId(null);
    }
  }, [applications, expandedRowId]);

  const handleStartEdit = (application) => {
    if (updateApplication.isPending) return;
    setEditingApplicationId(application.id);
    setEditingApplicationsCount(String(application.applications_count ?? 0));
    setEditMessage(null);
  };

  const handleCancelEdit = () => {
    if (updateApplication.isPending) return;
    setEditingApplicationId(null);
    setEditingApplicationsCount('');
    setEditMessage(null);
  };

  const handleApproveApplication = (application) => {
    if (!token || approveApplication.isPending) return;
    setEditMessage(null);
    approveApplication.mutate({ applicationId: application.id, approved: true });
  };

  const handleRejectApplication = (application) => {
    if (!token || deleteApplication.isPending) return;
    setEditMessage(null);
    deleteApplication.mutate(application.id);
  };

  const handleSaveEdit = (applicationId) => {
    if (!token || !applicationId || updateApplication.isPending) {
      return;
    }

    if (editingApplicationsCount === '') {
      setEditMessage({ type: 'error', text: 'Enter a count before saving.' });
      return;
    }

    const parsedCount = Number(editingApplicationsCount);
    if (!Number.isInteger(parsedCount) || parsedCount < 0) {
      setEditMessage({ type: 'error', text: 'Applications count must be a non-negative integer.' });
      return;
    }

    setEditMessage(null);
    updateApplication.mutate({
      applicationId,
      payload: { applications_count: parsedCount },
    });
  };

  const toggleDetails = (applicationId) => {
    setExpandedRowId((prev) => (prev === applicationId ? null : applicationId));
  };

  return (
    <DashboardLayout
      title="Applications"
      subtitle={`Overview of recent submissions${searchTerm ? ` matching "${searchTerm}"` : ''}`}
      links={sidebarLinks}
      actions={
        <div className="flex gap-2">
          <PDFExportButton
            reportType="applications"
            data={{
              status: statusFilter || undefined,
              dateFrom: undefined,
              dateTo: undefined
            }}
            filename="applications-report"
            variant="outline"
            size="sm"
          />
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card className="p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-4 w-4" />
                Guided logging
              </div>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Multi-step application logger</h2>
              <p className="text-sm text-muted-foreground">
                Launch the modal to record outreach, interviews, and assessments without scrolling through a massive form.
              </p>
            </div>
            <LogApplicationModal token={token} onApplicationLogged={handleApplicationLogged} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>
                {todaysTotals.total} / {dailyTarget} logged today
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {todaysTotals.records} submissions today
              </Badge>
              <Badge variant="outline" className="text-xs">
                Target: {dailyTarget}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {remainingToTarget > 0
                ? `${remainingToTarget} more applications to hit today's quota.`
                : "Target met—log interviews or assessments to keep momentum."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {LOG_STEPS.map((step) => (
              <div
                key={step.label}
                className="rounded-lg border border-dashed border-border/70 bg-card/60 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {step.label}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{step.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <h2 className="text-xl font-semibold text-foreground">{userName}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
              >
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvancedFilters ? 'Hide advanced filters' : 'Show advanced filters'}
              </Button>
              {!showAdvancedFilters && (searchTerm || statusFilter) ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {searchTerm && <Badge variant="outline">Search: {searchTerm}</Badge>}
                  {statusFilter && (
                    <Badge variant="outline">Status: {formatLabel(statusFilter)}</Badge>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {showAdvancedFilters ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search applications..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-10"
                  />
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <select
                  className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Active filters
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {!searchTerm && !statusFilter ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : null}
                  {searchTerm ? (
                    <Badge variant="outline" className="text-xs">
                      Search: {searchTerm}
                    </Badge>
                  ) : null}
                  {statusFilter ? (
                    <Badge variant="outline" className="text-xs">
                      Status: {formatLabel(statusFilter)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Filtered Records" value={filteredApplications.length} />
            <SummaryCard label="Approved Total (Filtered)" value={filteredApprovalSummary.approved} />
            <SummaryCard label="Pending Total (Filtered)" value={filteredApprovalSummary.pending} />
            <SummaryCard label="Pending Records" value={filteredApprovalSummary.pendingRecords} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status Overview
            </p>
            {applicationsLoading ? (
              <div className="text-xs text-muted-foreground">Loading status insights...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => {
                  const details = STATUS_DETAILS[status] ?? {
                    label: formatLabel(status),
                    tone: 'border border-border bg-muted text-foreground',
                  };
                  const isActive = statusFilter === status;
                  const count = statusSummary[status] ?? 0;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        const nextStatus = isActive ? '' : status;
                        setStatusFilter(nextStatus);
                        track('recruiter_status_chip_clicked', {
                          status,
                          active: nextStatus === status,
                          total: statusSummary[status] ?? 0,
                        });
                      }}
                      title={`Filter by ${details.label}`}
                      aria-pressed={isActive}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${details.tone} ${
                        isActive ? 'ring-2 ring-offset-1 ring-primary/60' : 'hover:border-primary/40'
                      }`}
                    >
                      <span>{details.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Click a stage to filter the table. Counts reflect the records currently loaded for this recruiter.
            </p>
            {!applicationsLoading && statusSummaryTotal > 0 && (
              <div className="w-full space-y-1">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {STATUS_OPTIONS.map((status) => {
                    const count = statusSummary[status] ?? 0;
                    if (!count) {
                      return null;
                    }
                    const width = (count / statusSummaryTotal) * 100;
                    const barClass = STATUS_DETAILS[status]?.bar ?? 'bg-primary';
                    return (
                      <div
                        key={`heat-${status}`}
                        className={`${barClass} transition-all`}
                        style={{ width: `${width}%`, minWidth: '4px' }}
                        title={`${STATUS_DETAILS[status]?.label ?? formatLabel(status)}: ${count}`}
                      />
                    );
                  })}
                </div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pipeline distribution across {statusSummaryTotal} records
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Upcoming Interviews</h3>
                <p className="text-sm text-muted-foreground">
                  Keep track of scheduled conversations so nothing slips through.
                </p>
              </div>
              {interviews.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(interviews.length, 5)} of {interviews.length}
                </span>
              )}
            </div>
            {interviewsLoading || interviewsRefetching ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading interviews...
              </div>
            ) : interviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No upcoming interviews logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {interviews.slice(0, 5).map((interview) => (
                  <div
                    key={interview.id}
                    className="rounded-md border border-border bg-card/70 p-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {interview.candidate_name || 'Candidate'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {interview.company_name || 'Company not set'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        {formatDateTime(interview.scheduled_date)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatLabel(interview.interview_type)}</span>
                      <span>Round {interview.round_number || 1}</span>
                      <span>{interview.timezone || 'UTC'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToCandidate(interview.candidate_id)}
                        className="text-xs"
                      >
                        View candidate
                      </Button>
                    </div>
                    {interview.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {interview.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Pending Assessments</h3>
                <p className="text-sm text-muted-foreground">
                  Track assessments awaiting completion or review.
                </p>
              </div>
              {assessments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(assessments.length, 5)} of {assessments.length}
                </span>
              )}
            </div>
            {assessmentsLoading || assessmentsRefetching ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading assessments...
              </div>
            ) : assessments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No pending assessments logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {assessments.slice(0, 5).map((assessment) => (
                  <div
                    key={assessment.id}
                    className="rounded-md border border-border bg-card/70 p-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {assessment.candidate_name || 'Candidate'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assessment.assessment_platform || 'Platform not set'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        Due {formatDate(assessment.due_date)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatLabel(assessment.assessment_type)}</span>
                      <span>{formatLabel(assessment.status)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToCandidate(assessment.candidate_id)}
                        className="text-xs"
                      >
                        View candidate
                      </Button>
                    </div>
                    {assessment.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {assessment.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="overflow-hidden">
          {applicationsLoading || applicationsRefetching ? (
            <div className="p-6 text-center text-muted-foreground">Loading applications...</div>
          ) : filteredApplications.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Applications Found"
              description="It looks like you haven't logged any applications yet. Get started by adding a new submission."
              action={
                <LogApplicationModal token={token} onApplicationLogged={handleApplicationLogged} />
              }
            />
          ) : (
            <div className="p-6 space-y-4">
              {editMessage && (
                <div
                  className={`rounded-md border px-4 py-2 text-sm ${
                    editMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {editMessage.text}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium">Recruiter</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Job Title</th>
                    <th className="px-4 py-3 text-left font-medium">Channel</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Applied On</th>
                    <th className="px-4 py-3 text-right font-medium">Count</th>
                    <th className="px-4 py-3 text-left font-medium">Approval</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => {
                    const isEditing = editingApplicationId === application.id;
                    const normalizedDate = application.application_date
                      ? new Date(application.application_date).toISOString().split('T')[0]
                      : null;
                    const isApproved = Boolean(application.is_approved);
                    const canEdit =
                      userRole === 'Admin' ||
                      (!isApproved && (normalizedDate ? normalizedDate === today : true));
                    const approvalUpdating =
                      approveApplication.isPending &&
                      approveApplication.variables?.applicationId === application.id;
                    const rowClasses = `border-b border-border transition ${
                      isEditing ? 'bg-muted/30' : 'hover:bg-accent/40'
                    } ${isApproved ? '' : 'border-l-4 border-l-amber-400'}`;

                    return (
                      <React.Fragment key={application.id}>
                        <tr className={rowClasses}>
                          <td className="px-4 py-3 text-foreground">
                            {application.candidate_id ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                goToCandidate(application.candidate_id);
                              }}
                            >
                              {application.candidate_name || 'View candidate'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {application.recruiter_id ? (
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                goToRecruiterProfile(application.recruiter_id);
                              }}
                            >
                              {application.recruiter_name || 'Recruiter'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">{application.company_name || '--'}</td>
                        <td className="px-4 py-3 text-foreground">{application.job_title || '--'}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{application.channel || '--'}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{application.status || '--'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {application.application_date
                            ? new Date(application.application_date).toLocaleDateString()
                            : '--'}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground font-medium">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              value={editingApplicationsCount}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                setEditingApplicationsCount(event.target.value);
                                if (editMessage) setEditMessage(null);
                              }}
                              className="w-24 ml-auto"
                            />
                          ) : (
                            application.applications_count || 0
                          )}
                        </td>
                        <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isApproved
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }
                      >
                        {isApproved ? 'Approved' : 'Pending'}
                      </Badge>
                      {userRole === 'Admin' && (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleApproveApplication(application);
                            }}
                            disabled={approvalUpdating || isApproved}
                          >
                            {approvalUpdating ? 'Updating...' : 'Approve'}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRejectApplication(application);
                            }}
                            disabled={deleteApplication.isPending}
                          >
                            {deleteApplication.isPending ? 'Deleting...' : 'Reject'}
                          </Button>
                        </>
                      )}
                    </div>
                        </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleCancelEdit();
                                  }}
                                  disabled={updateApplication.isPending}
                                >
                                  <X size={14} />
                                  <span className="sr-only">Cancel</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSaveEdit(application.id);
                                  }}
                                  disabled={updateApplication.isPending}
                                >
                                  {updateApplication.isPending ? (
                                    'Saving...'
                                  ) : (
                                    <>
                                      <Check size={14} className="mr-1" />
                                      Save
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap justify-end gap-2">
                                {canEdit ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleStartEdit(application);
                                    }}
                                    disabled={Boolean(editingApplicationId)}
                                  >
                                    <Edit size={14} className="mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground self-center">
                                    {isApproved ? 'Locked (approved)' : 'Locked'}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleDetails(application.id);
                                  }}
                                  aria-expanded={expandedRowId === application.id}
                                >
                                  {expandedRowId === application.id ? (
                                    <>
                                      <ChevronUp size={14} />
                                      Hide details
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />
                                      Details
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {expandedRowId === application.id ? (
                          <tr className="bg-muted/30">
                            <td colSpan={10} className="px-6 py-4 text-sm text-muted-foreground">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Record insights
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xs text-muted-foreground">Logged</span>
                                      <span className="text-foreground">
                                        {application.created_at
                                          ? formatDateTime(application.created_at)
                                          : application.application_date
                                          ? formatDateTime(application.application_date)
                                          : '--'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xs text-muted-foreground">Updated</span>
                                      <span className="text-foreground">
                                        {application.updated_at
                                          ? formatDateTime(application.updated_at)
                                          : '--'}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-xs text-muted-foreground">Record ID</span>
                                      <span className="text-foreground font-medium">#{application.id}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Quota notes
                                  </p>
                                  <p className="mt-2 text-sm text-foreground">
                                    {application.reduction_reason || 'No quota adjustment logged.'}
                                  </p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {application.notes ||
                                      application.internal_notes ||
                                      'No recruiter notes captured for this record.'}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
  </div>
);

export default ApplicationsPage;















