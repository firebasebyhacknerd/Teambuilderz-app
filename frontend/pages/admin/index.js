import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  Briefcase,
  BarChart3,
  Target,
  FileText,
  AlertTriangle,
  Home,
  LogOut,
  PieChart,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  Bell,
  CalendarClock,
  ChevronRight,
  UserCheck,
  Check,
  X,
  CheckCircle,
  XCircle,
  CircleUser,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import EmptyState from '../../components/ui/empty-state';
import {
  useAdminOverviewQuery,
  useAdminActivityQuery,
  useNotificationsQuery,
  useUserActivityQuery,
} from '../../lib/queryHooks';
import API_URL from '../../lib/api';
import { formatLabel } from '../../lib/formatting';
import { getAdminSidebarLinks } from '../../lib/adminSidebarLinks';
import { emitRefresh, useRefreshListener, REFRESH_CHANNELS } from '../../lib/refreshBus';

const numberFormatter = new Intl.NumberFormat();
const decimalFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', minimumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const humanizeLabel = (value) => {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  const formatted = formatLabel(value, 'N/A');
  return formatted || 'N/A';
};

const AdminDashboard = ({ now }) => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [approvalAction, setApprovalAction] = useState(null);
  const rangeOptions = useMemo(
    () => [
      { value: 'today', label: 'Today', shortLabel: 'Today', days: 1 },
      { value: '7d', label: 'Last 7 days', shortLabel: '7d', days: 7 },
      { value: '30d', label: 'Last 30 days', shortLabel: '30d', days: 30 },
    ],
    [],
  );
  const [range, setRange] = useState('today');
  const baseToday = useMemo(() => new Date(now || Date.now()), [now]);
  const rangeConfig = useMemo(() => {
    const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[0];
    const today = baseToday;
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (option.days - 1));
    const format = (date) => date.toISOString().split('T')[0];
    return {
      ...option,
      startDate,
      endDate,
      startDateStr: format(startDate),
      endDateStr: format(endDate),
    };
  }, [baseToday, range, rangeOptions]);
  const rangeParams = useMemo(
    () => ({
      date_from: rangeConfig.startDateStr,
      date_to: rangeConfig.endDateStr,
    }),
    [rangeConfig.startDateStr, rangeConfig.endDateStr],
  );

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    if (storedRole !== 'Admin') {
      router.replace('/recruiter');
      return;
    }
    setToken(storedToken);
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    }
  }, [router]);

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useAdminOverviewQuery(token, Boolean(token), rangeParams);
  const {
    data: activity,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useAdminActivityQuery(token, Boolean(token), rangeParams);
  const { data: notifications, isLoading: notificationsLoading } = useNotificationsQuery(token, Boolean(token));
  const { data: userActivity, isLoading: userActivityLoading } = useUserActivityQuery(token, Boolean(token));

  const handleExternalDashboardRefresh = useCallback(() => {
    if (!token) {
      return;
    }
    refetchOverview();
    refetchActivity();
  }, [refetchActivity, refetchOverview, token]);

  useRefreshListener(REFRESH_CHANNELS.DASHBOARD, handleExternalDashboardRefresh);

  const summary = overview?.summary ?? {
    totalCandidates: 0,
    activeCandidates: 0,
    marketingCandidates: 0,
    avgCandidateTenureDays: 0,
    totalRecruiters: 0,
    totalApplicationsToday: 0,
    totalInterviewsToday: 0,
    totalAssessmentsToday: 0,
    applicationsTodayBreakdown: {
      total: 0,
      approved: 0,
      pending: 0,
    },
    avgApplicationsPerDay: 0,
    avgApplicationsPerRecruiterPerDay: 0,
  };

  const activityTrendPoints = useMemo(
    () =>
      (overview?.activityTrend ?? []).map((point) => ({
        date: point.date,
        applications: Number(point.applications) || 0,
        interviews: Number(point.interviews) || 0,
        assessments: Number(point.assessments) || 0,
      })),
    [overview?.activityTrend],
  );
  const trendWindowLabel = activityTrendPoints.length > 1 ? `${activityTrendPoints.length}-day trend` : null;
  const applicationsTrend = useMemo(
    () => activityTrendPoints.map((point) => point.applications),
    [activityTrendPoints],
  );
  const interviewsTrend = useMemo(
    () => activityTrendPoints.map((point) => point.interviews),
    [activityTrendPoints],
  );
  const assessmentsTrend = useMemo(
    () => activityTrendPoints.map((point) => point.assessments),
    [activityTrendPoints],
  );

  const applicationsTodayBreakdown = summary.applicationsTodayBreakdown ?? {
    total: 0,
    approved: 0,
    pending: 0,
  };
  const applicationsApprovedToday = applicationsTodayBreakdown.approved ?? 0;
  const applicationsPendingToday = applicationsTodayBreakdown.pending ?? 0;
const applicationsTodayDetails = (
  <span className="flex flex-wrap items-center gap-2">
    <span className="font-semibold text-muted-foreground">{rangeConfig.shortLabel}</span>
    <span className="text-muted-foreground">{'\u2022'}</span>
    <span className="font-semibold text-emerald-600">
      Approved {numberFormatter.format(applicationsApprovedToday)}
    </span>
    <span className="text-muted-foreground">{'\u2022'}</span>
    <span
        className={`font-semibold ${
          applicationsPendingToday > 0 ? 'text-amber-600' : 'text-muted-foreground'
        }`}
      >
        Pending {numberFormatter.format(applicationsPendingToday)}
      </span>
    </span>
  );
  const candidateStages = overview?.candidateStages ?? [];
  const marketingVelocity = overview?.marketingVelocity ?? {
    avgApplicationsPerCandidate: 0,
    avgDaysSinceLastApplication: 0,
  };
  const recruiterProductivity = overview?.recruiterProductivity ?? [];

  const [pendingRecruiterId, setPendingRecruiterId] = useState('all');
  const pendingApprovalsRef = useRef(null);
  const [pendingFocusType, setPendingFocusType] = useState(null);
  const [selectedApprovals, setSelectedApprovals] = useState(() => ({
    applications: new Set(),
    interviews: new Set(),
    assessments: new Set(),
  }));

  const cloneSelectionBuckets = (source) => ({
    applications: new Set(source.applications),
    interviews: new Set(source.interviews),
    assessments: new Set(source.assessments),
  });

  const toggleSelection = useCallback((type, id) => {
    if (!type || !id) return;
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    setSelectedApprovals((prev) => {
      const next = cloneSelectionBuckets(prev);
      const bucket = next[type];
      if (!bucket) {
        return prev;
      }
      if (bucket.has(numericId)) {
        bucket.delete(numericId);
      } else {
        bucket.add(numericId);
      }
      return next;
    });
  }, []);

  const selectAllForType = useCallback((type, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    setSelectedApprovals((prev) => {
      const next = cloneSelectionBuckets(prev);
      const bucket = next[type];
      if (!bucket) {
        return prev;
      }
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .forEach((value) => bucket.add(value));
      return next;
    });
  }, []);

  const clearSelectionForType = useCallback((type) => {
    setSelectedApprovals((prev) => {
      if (!prev[type] || prev[type].size === 0) {
        return prev;
      }
      const next = cloneSelectionBuckets(prev);
      next[type].clear();
      return next;
    });
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedApprovals({
      applications: new Set(),
      interviews: new Set(),
      assessments: new Set(),
    });
  }, []);

  const recentNotes = activity?.recentNotes ?? [];
  const upcomingReminders = activity?.upcomingReminders ?? [];
  const recruiterNotes = activity?.recruiterNotes ?? [];
  const rawPendingApprovals = activity?.pendingApprovals;
  const pendingApprovals = useMemo(
    () =>
      rawPendingApprovals ?? {
        applications: [],
        interviews: [],
        assessments: [],
      },
    [rawPendingApprovals],
  );

  useEffect(() => {
    setSelectedApprovals((prev) => {
      const allowed = {
        applications: new Set(pendingApprovals.applications.map((item) => Number(item.id))),
        interviews: new Set(pendingApprovals.interviews.map((item) => Number(item.id))),
        assessments: new Set(pendingApprovals.assessments.map((item) => Number(item.id))),
      };
      const next = {
        applications: new Set([...prev.applications].filter((id) => allowed.applications.has(id))),
        interviews: new Set([...prev.interviews].filter((id) => allowed.interviews.has(id))),
        assessments: new Set([...prev.assessments].filter((id) => allowed.assessments.has(id))),
      };
      const isSame =
        next.applications.size === prev.applications.size &&
        next.interviews.size === prev.interviews.size &&
        next.assessments.size === prev.assessments.size &&
        [...next.applications].every((id) => prev.applications.has(id)) &&
        [...next.interviews].every((id) => prev.interviews.has(id)) &&
        [...next.assessments].every((id) => prev.assessments.has(id));
      return isSame ? prev : next;
    });
  }, [pendingApprovals]);
  const recentApprovals = activity?.recentApprovals ?? [];
  const pendingApprovalOptions = useMemo(() => {
    const recruiterMap = new Map();
    let hasUnassigned = false;

    const trackRecruiter = (item) => {
      const recruiter = item?.recruiter ?? null;
      if (!recruiter || recruiter.id === null || recruiter.id === undefined) {
        hasUnassigned = true;
        return;
      }
      const name = recruiter.name || `Recruiter ${recruiter.id}`;
      recruiterMap.set(recruiter.id, name);
    };

    const collect = (items) => {
      items.forEach(trackRecruiter);
    };

    collect(pendingApprovals.applications);
    collect(pendingApprovals.interviews);
    collect(pendingApprovals.assessments);

    const options = [{ value: 'all', label: 'All recruiters' }];
    const sortedRecruiters = Array.from(recruiterMap.entries()).sort((a, b) =>
      String(a[1]).localeCompare(String(b[1])),
    );
    sortedRecruiters.forEach(([id, name]) => {
      options.push({ value: String(id), label: name });
    });
    if (hasUnassigned) {
      options.push({ value: 'unassigned', label: 'Unassigned' });
    }
    return options;
  }, [pendingApprovals.applications, pendingApprovals.interviews, pendingApprovals.assessments]);

  useEffect(() => {
    const availableValues = new Set(pendingApprovalOptions.map((option) => option.value));
    if (!availableValues.has(pendingRecruiterId)) {
      setPendingRecruiterId('all');
    }
  }, [pendingApprovalOptions, pendingRecruiterId]);

  const selectedPendingOption = useMemo(
    () => pendingApprovalOptions.find((option) => option.value === pendingRecruiterId) ?? null,
    [pendingApprovalOptions, pendingRecruiterId],
  );
  const canBulkAct =
    selectedPendingOption &&
    selectedPendingOption.value !== 'all' &&
    selectedPendingOption.value !== 'unassigned';

  const filteredPendingApprovals = useMemo(() => {
    if (pendingRecruiterId === 'all') {
      return pendingApprovals;
    }

    const matchesFilter = (item) => {
      const recruiterId = item?.recruiter?.id;
      if (pendingRecruiterId === 'unassigned') {
        return recruiterId === null || recruiterId === undefined;
      }
      return String(recruiterId ?? '') === pendingRecruiterId;
    };

    return {
      applications: pendingApprovals.applications.filter(matchesFilter),
      interviews: pendingApprovals.interviews.filter(matchesFilter),
      assessments: pendingApprovals.assessments.filter(matchesFilter),
    };
  }, [pendingApprovals, pendingRecruiterId]);

  const pendingCounts = useMemo(
    () => ({
      applications: filteredPendingApprovals.applications.length,
      interviews: filteredPendingApprovals.interviews.length,
      assessments: filteredPendingApprovals.assessments.length,
    }),
    [filteredPendingApprovals],
  );

  const selectedCounts = useMemo(() => ({
    applications: selectedApprovals.applications.size,
    interviews: selectedApprovals.interviews.size,
    assessments: selectedApprovals.assessments.size,
    total:
      selectedApprovals.applications.size +
      selectedApprovals.interviews.size +
      selectedApprovals.assessments.size,
  }), [selectedApprovals]);

  const isItemSelected = useCallback(
    (type, id) => {
      if (!type || !id) return false;
      const numericId = Number(id);
      if (!Number.isFinite(numericId) || numericId <= 0) return false;
      return selectedApprovals[type]?.has(numericId) ?? false;
    },
    [selectedApprovals],
  );
  const focusPendingApprovals = useCallback((type) => {
    setPendingFocusType(type);
    requestAnimationFrame(() => {
      if (pendingApprovalsRef.current) {
        pendingApprovalsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  useEffect(() => {
    if (!pendingFocusType || typeof window === 'undefined') return;
    const handle = window.setTimeout(() => setPendingFocusType(null), 2500);
    return () => window.clearTimeout(handle);
  }, [pendingFocusType]);

  const notesByRecruiter = activity?.notesByRecruiter ?? [];
  const centerReminders = notifications?.reminders ?? [];
  const centerAlerts = notifications?.alerts ?? [];
  const usersWithStatus = userActivity?.users ?? [];
  const userActivityGeneratedAt = userActivity?.generatedAt ?? null;
  const totalRecruiterNotes = notesByRecruiter.reduce((sum, entry) => sum + (entry.totalNotes || 0), 0);
  const totalNotesLastWeek = notesByRecruiter.reduce(
    (sum, entry) => sum + (entry.notesLast7Days || 0),
    0,
  );
  const userActivityTimestamp = userActivityGeneratedAt
    ? dateTimeFormatter.format(new Date(userActivityGeneratedAt))
    : null;

  const isLoading =
    overviewLoading || activityLoading || notificationsLoading || userActivityLoading || !token;

  const isProcessingApproval = (type, id) =>
    approvalAction && approvalAction.type === type && (id === undefined || approvalAction.id === id);

  const handleApprovalAction = async (type, itemId, action) => {
    if (!token) {
      return;
    }

    setApprovalAction({ type, id: itemId, action });
    try {
      const jsonHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const ensureOk = async (response, fallbackMessage) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || fallbackMessage);
        }
      };

      if (type === 'application') {
        if (action === 'approve') {
          const response = await fetch(`${API_URL}/api/v1/applications/${itemId}/approval`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ approved: true }),
          });
          await ensureOk(response, 'Unable to approve application.');
        } else {
          const response = await fetch(`${API_URL}/api/v1/applications/${itemId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          await ensureOk(response, 'Unable to reject application.');
        }
      } else if (type === 'interview') {
        const response = await fetch(`${API_URL}/api/v1/interviews/${itemId}/approval`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ approved: action === 'approve' }),
        });
        await ensureOk(response, 'Unable to update interview approval.');
      } else if (type === 'assessment') {
        const response = await fetch(`${API_URL}/api/v1/assessments/${itemId}/approval`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ approved: action === 'approve' }),
        });
        await ensureOk(response, 'Unable to update assessment approval.');
      }

      await Promise.all([refetchActivity(), refetchOverview()]);
      emitRefresh(REFRESH_CHANNELS.DASHBOARD);
      emitRefresh(REFRESH_CHANNELS.PERFORMANCE);
    } catch (error) {
      console.error('Approval action failed:', error);
    } finally {
      setApprovalAction(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.warn('Failed to log out cleanly', logoutError);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const handleBulkApprovalAction = async (action) => {
    if (!token || !canBulkAct) {
      return;
    }
    const recruiterId = Number(pendingRecruiterId);
    if (!Number.isFinite(recruiterId) || recruiterId <= 0) {
      return;
    }
    const activeTypes = [];
    if (pendingCounts.applications > 0) activeTypes.push('applications');
    if (pendingCounts.interviews > 0) activeTypes.push('interviews');
    if (pendingCounts.assessments > 0) activeTypes.push('assessments');
    if (activeTypes.length === 0) {
      return;
    }

    const recruiterLabel = selectedPendingOption?.label ?? 'the selected recruiter';
    const actionLabel = action === 'approve' ? 'approve' : 'reject';
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Are you sure you want to ${actionLabel} all pending items for ${recruiterLabel}?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setApprovalAction({ type: 'bulk', id: `${action}-${recruiterId}` });
    try {
      const response = await fetch(`${API_URL}/api/v1/pending-approvals/bulk`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recruiterId, action, types: activeTypes }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Bulk action failed.');
      }
      await Promise.all([refetchActivity(), refetchOverview()]);
      emitRefresh(REFRESH_CHANNELS.DASHBOARD);
      emitRefresh(REFRESH_CHANNELS.PERFORMANCE);
      clearAllSelections();
    } catch (error) {
      console.error('Bulk approval action failed:', error);
    } finally {
      setApprovalAction(null);
    }
  };

  const handleSelectedApprovalAction = useCallback(
    async (action) => {
      if (!token) {
        return;
      }
      const applicationSelection = Array.from(selectedApprovals.applications);
      const interviewSelection = Array.from(selectedApprovals.interviews);
      const assessmentSelection = Array.from(selectedApprovals.assessments);
      if (
        applicationSelection.length === 0 &&
        interviewSelection.length === 0 &&
        assessmentSelection.length === 0
      ) {
        return;
      }

      const payload = {
        action,
        types: [],
      };
      if (applicationSelection.length) {
        payload.types.push('applications');
        payload.applicationIds = applicationSelection;
      }
      if (interviewSelection.length) {
        payload.types.push('interviews');
        payload.interviewIds = interviewSelection;
      }
      if (assessmentSelection.length) {
        payload.types.push('assessments');
        payload.assessmentIds = assessmentSelection;
      }
      if (payload.types.length === 0) {
        return;
      }
      if (pendingRecruiterId !== 'all' && pendingRecruiterId !== 'unassigned') {
        const recruiterCandidate = Number(pendingRecruiterId);
        if (Number.isFinite(recruiterCandidate) && recruiterCandidate > 0) {
          payload.recruiterId = recruiterCandidate;
        }
      }

      if (typeof window !== 'undefined') {
        const actionLabel = action === 'approve' ? 'approve' : 'reject';
        const confirmed = window.confirm(`Are you sure you want to ${actionLabel} the selected items?`);
        if (!confirmed) {
          return;
        }
      }

      setApprovalAction({ type: 'bulk', id: `selection-${action}` });
      try {
        const response = await fetch(`${API_URL}/api/v1/pending-approvals/bulk`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Selection action failed.');
        }
        await Promise.all([refetchActivity(), refetchOverview()]);
        setSelectedApprovals({
          applications: new Set(),
          interviews: new Set(),
          assessments: new Set(),
        });
      } catch (error) {
        console.error('Selection approval action failed:', error);
      } finally {
        setApprovalAction(null);
      }
    },
    [pendingRecruiterId, refetchActivity, refetchOverview, selectedApprovals, token],
  );

  const sidebarLinks = useMemo(() => getAdminSidebarLinks(), []);

  if (isLoading) {
    return (
      <DashboardLayout title="Admin Dashboard" subtitle={`Welcome back, ${userName}`} links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading dashboard...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle={`Welcome back, ${userName}`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Reporting Range</p>
          <p className="text-xs text-muted-foreground">
            {rangeConfig.startDateStr} &ndash; {rangeConfig.endDateStr}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rangeOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={range === option.value ? 'default' : 'outline'}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
        <KpiCard
          icon={<Users className="h-5 w-5 text-primary" />}
          title="Candidate roster"
          value={summary.totalCandidates}
          accent="bg-primary/10 text-primary"
          details={`${numberFormatter.format(summary.marketingCandidates || 0)} marketing Â· ${numberFormatter.format(
            summary.activeCandidates || 0,
          )} active`}
          actionLabel="Open candidates"
          onAction={() => router.push('/admin/candidates')}
        />
        <KpiCard
          icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
          title="Active recruiters"
          value={summary.totalRecruiters}
          accent="bg-emerald-100 text-emerald-700"
          details={`${numberFormatter.format(summary.totalRecruiters || 0)} team members`}
          actionLabel="View team load"
          onAction={() => router.push('/admin/recruiters')}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          title="Avg applications / day"
          value={summary.avgApplicationsPerDay}
          accent="bg-orange-100 text-orange-700"
          details={`${numberFormatter.format(summary.totalApplicationsToday || 0)} total this ${rangeConfig.label}`}
          valueFormatter={decimalFormatter}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
          title="Applications awaiting approval"
          value={pendingCounts.applications}
          accent="bg-blue-100 text-blue-700"
          details={
            pendingCounts.applications > 0
              ? applicationsTodayDetails
              : 'All approvals are up to date.'
          }
          actionLabel="Review applications"
          onAction={() => focusPendingApprovals('applications')}
          actionDisabled={pendingCounts.applications === 0}
          trendData={applicationsTrend}
          trendLabel={trendWindowLabel}
          trendColor="text-blue-600"
        />
        <KpiCard
          icon={<Target className="h-5 w-5 text-pink-600" />}
          title="Interviews awaiting approval"
          value={pendingCounts.interviews}
          accent="bg-pink-100 text-pink-700"
          details={
            pendingCounts.interviews > 0
              ? `${numberFormatter.format(summary.totalInterviewsToday || 0)} logged this ${rangeConfig.shortLabel}`
              : 'No interviews pending'
          }
          actionLabel="Review interviews"
          onAction={() => focusPendingApprovals('interviews')}
          actionDisabled={pendingCounts.interviews === 0}
          trendData={interviewsTrend}
          trendLabel={trendWindowLabel}
          trendColor="text-pink-600"
        />
        <KpiCard
          icon={<ClipboardList className="h-5 w-5 text-purple-600" />}
          title="Assessments awaiting approval"
          value={pendingCounts.assessments}
          accent="bg-purple-100 text-purple-700"
          details={
            pendingCounts.assessments > 0
              ? `${numberFormatter.format(summary.totalAssessmentsToday || 0)} logged this ${rangeConfig.shortLabel}`
              : 'No assessments pending'
          }
          actionLabel="Review assessments"
          onAction={() => focusPendingApprovals('assessments')}
          actionDisabled={pendingCounts.assessments === 0}
          trendData={assessmentsTrend}
          trendLabel={trendWindowLabel}
          trendColor="text-purple-600"
        />
      </div>

      <div ref={pendingApprovalsRef} id="pending-approvals">
        <PendingApprovalsCard
          approvals={filteredPendingApprovals}
          onAction={handleApprovalAction}
          isProcessing={isProcessingApproval}
          numberFormatter={numberFormatter}
          dateFormatter={dateFormatter}
          dateTimeFormatter={dateTimeFormatter}
          filterValue={pendingRecruiterId}
          filterOptions={pendingApprovalOptions}
          onFilterChange={setPendingRecruiterId}
          bulkProcessing={approvalAction?.type === 'bulk'}
          canBulkAct={Boolean(canBulkAct)}
          selectedRecruiterLabel={selectedPendingOption?.label}
          onBulkAction={handleBulkApprovalAction}
          pendingCounts={pendingCounts}
          highlightType={pendingFocusType}
          selectedCounts={selectedCounts}
          onSelectedAction={handleSelectedApprovalAction}
          isItemSelected={isItemSelected}
          onToggleSelection={toggleSelection}
          onSelectAll={selectAllForType}
          onClearSelection={clearSelectionForType}
          onClearAllSelections={clearAllSelections}
        />
      </div>
      <RecentApprovalsCard approvals={recentApprovals} dateTimeFormatter={dateTimeFormatter} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Candidate Pipeline
              </h3>
              <p className="text-sm text-muted-foreground">
                Average tenure {numberFormatter.format(Math.round(summary.avgCandidateTenureDays))} days across the bench.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidateStages.length === 0 ? (
              <EmptyState
                className="col-span-2"
                icon={PieChart}
                title="No pipeline data"
                description="Add or import candidates to visualize stage distribution."
                action={
                  <Button type="button" size="sm" onClick={() => router.push('/admin/candidates')}>
                    Go to candidates
                  </Button>
                }
              />
            ) : (
              candidateStages.map((stage) => (
                <StageChip key={stage.stage} label={stage.stage} count={stage.count} total={summary.totalCandidates || 1} />
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Marketing Velocity
              </h3>
              <p className="text-sm text-muted-foreground">
                Keep outreach momentum steady and spot dormant candidates quickly.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricTile label="Avg apps per candidate" value={marketingVelocity.avgApplicationsPerCandidate.toFixed(1)} tone="bg-emerald-50 text-emerald-700" />
            <MetricTile label="Avg days since last app" value={marketingVelocity.avgDaysSinceLastApplication.toFixed(1)} tone="bg-amber-50 text-amber-700" />
            <MetricTile label="Marketing candidates" value={summary.marketingCandidates} tone="bg-blue-50 text-blue-700" />
            <MetricTile label="Active candidates" value={summary.activeCandidates} tone="bg-purple-50 text-purple-700" />
          </div>
        </Card>
      </div>

      <Card className="p-0 mb-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Recruiter Productivity</h2>
          <p className="text-xs text-muted-foreground">Tracking applications, interviews, and trend averages.</p>
        </div>
        <div className="divide-y divide-border">
          {recruiterProductivity.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No productivity data yet"
              description="As recruiters start logging activity, their application and interview contributions will appear here."
            />
          ) : (
            recruiterProductivity.map((recruiter) => (
              <RecruiterListItem
                key={recruiter.id}
                recruiter={recruiter}
                rangeLabel={rangeConfig.label}
                rangeDays={rangeConfig.days}
              />
            ))
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Presence
              </h3>
              <p className="text-sm text-muted-foreground">
                {userActivityTimestamp
                  ? `Updated ${userActivityTimestamp}`
                  : 'Presence updates refresh automatically.'}
              </p>
            </div>
          </div>
          {usersWithStatus.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members online"
              description="Invite recruiters or ensure accounts are active to see presence data."
            />
          ) : (
            <div className="space-y-2">
              {usersWithStatus.slice(0, 10).map((user) => (
                <UserPresenceRow key={user.id} user={user} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
                Recruiter Notes Pulse
              </h3>
              <p className="text-sm text-muted-foreground">
                Monitor collaboration volume and freshness across recruiters.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricTile
              label="Total notes logged"
              value={numberFormatter.format(totalRecruiterNotes)}
              tone="bg-slate-100 text-slate-700"
            />
            <MetricTile
              label="Notes logged (7 days)"
              value={numberFormatter.format(totalNotesLastWeek)}
              tone="bg-emerald-50 text-emerald-700"
            />
          </div>
          {notesByRecruiter.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No note activity"
              description="Encourage recruiters to log notes after every touchpoint."
            />
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border bg-card/50">
              {notesByRecruiter.map((summary) => (
                <NotesSummaryRow key={summary.id} summary={summary} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-8">
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Recent Collaboration
          </h3>
          {recentNotes.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No recent notes"
              description="Newly logged notes will appear here for quick review."
            />
          ) : (
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <ActivityNoteItem key={note.id} note={note} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            Upcoming Reminders
          </h3>
          {upcomingReminders.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing scheduled"
              description="Set reminders on candidates or notes to keep the team on track."
            />
          ) : (
            <div className="space-y-3">
              {upcomingReminders.map((reminder) => (
                <ReminderItem key={reminder.id} reminder={reminder} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Recruiter Notes Feed
          </h3>
          <p className="text-sm text-muted-foreground">
            Detailed log of recruiter-authored notes for performance reviews.
          </p>
          {recruiterNotes.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No notes logged"
              description="Once recruiters add notes, they will stream into this feed."
            />
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {recruiterNotes.slice(0, 20).map((note) => (
                <ActivityNoteItem key={note.id} note={note} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-600" />
          Notification Center
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reminders</h4>
            {centerReminders.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No reminders"
                description="You're caught up on reminders right now."
              />
            ) : (
              <div className="space-y-2">
                {centerReminders.map((reminder) => (
                  <NotificationReminder key={reminder.id} reminder={reminder} />
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alerts</h4>
            {centerAlerts.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="All clear"
                description="No alerts require attention."
              />
            ) : (
              <div className="space-y-2">
                {centerAlerts.map((alert) => (
                  <NotificationAlert key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
};

const PendingApprovalsCard = ({
  approvals,
  onAction,
  isProcessing,
  numberFormatter,
  dateFormatter,
  dateTimeFormatter,
  filterValue,
  filterOptions,
  onFilterChange,
  bulkProcessing,
  canBulkAct,
  selectedRecruiterLabel,
  onBulkAction,
  pendingCounts,
  highlightType,
  selectedCounts,
  onSelectedAction,
  isItemSelected,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onClearAllSelections,
}) => {
  const hasApplications = approvals.applications.length > 0;
  const hasInterviews = approvals.interviews.length > 0;
  const hasAssessments = approvals.assessments.length > 0;
  const hasAny = hasApplications || hasInterviews || hasAssessments;
  const hasBulkable =
    pendingCounts &&
    (Number(pendingCounts.applications || 0) +
      Number(pendingCounts.interviews || 0) +
      Number(pendingCounts.assessments || 0) >
      0);
  const selectionTotals = {
    applications: selectedCounts?.applications ?? 0,
    interviews: selectedCounts?.interviews ?? 0,
    assessments: selectedCounts?.assessments ?? 0,
    total: selectedCounts?.total ?? 0,
  };

  const computeBusy = (type, id) => isProcessing?.(type, id) || bulkProcessing;

  const renderApplicationRow = (app) => {
    const candidateName = app.candidate?.name ?? 'Unknown candidate';
    const recruiterName = app.recruiter?.name ? `Recruiter ${app.recruiter.name}` : 'Unassigned recruiter';
    const jobSummary = [app.companyName, app.jobTitle].filter(Boolean).join(' \u2022 ');

    const metaParts = [
      `${numberFormatter.format(app.applicationsCount ?? 0)} submitted`,
      app.applicationDate ? `Dated ${dateFormatter.format(new Date(app.applicationDate))}` : null,
      app.createdAt ? `Logged ${dateTimeFormatter.format(new Date(app.createdAt))}` : null,
    ].filter(Boolean);

    return (
      <ApprovalRow
        key={`app-${app.id}`}
        title={candidateName}
        subtitle={jobSummary || 'Application details pending'}
        recruiterLabel={recruiterName}
        meta={metaParts.join(' \u2022 ')}
        isBusy={computeBusy('application', app.id)}
        onApprove={() => onAction('application', app.id, 'approve')}
        onReject={() => onAction('application', app.id, 'reject')}
        enableSelection={Boolean(onToggleSelection)}
        selected={isItemSelected?.('applications', app.id) ?? false}
        onToggleSelect={() => onToggleSelection?.('applications', app.id)}
        selectionDisabled={bulkProcessing || isProcessing?.('application', app.id)}
      />
    );
  };

  const renderInterviewRow = (interview) => {
    const candidateName = interview.candidate?.name ?? 'Unknown candidate';
    const recruiterName = interview.recruiter?.name ? `Recruiter ${interview.recruiter.name}` : 'Unassigned recruiter';
    const summary = [interview.companyName, humanizeLabel(interview.interviewType)].filter(Boolean).join(' \u2022 ');

    const metaParts = [
      interview.scheduledDate ? `Scheduled ${dateTimeFormatter.format(new Date(interview.scheduledDate))}` : null,
      interview.status ? `Status ${humanizeLabel(interview.status)}` : null,
      interview.createdAt ? `Logged ${dateTimeFormatter.format(new Date(interview.createdAt))}` : null,
    ].filter(Boolean);

    return (
      <ApprovalRow
        key={`interview-${interview.id}`}
        title={candidateName}
        subtitle={summary || 'Interview details pending'}
        recruiterLabel={recruiterName}
        meta={metaParts.join(' \u2022 ')}
        isBusy={computeBusy('interview', interview.id)}
        onApprove={() => onAction('interview', interview.id, 'approve')}
        onReject={() => onAction('interview', interview.id, 'reject')}
        enableSelection={Boolean(onToggleSelection)}
        selected={isItemSelected?.('interviews', interview.id) ?? false}
        onToggleSelect={() => onToggleSelection?.('interviews', interview.id)}
        selectionDisabled={bulkProcessing || isProcessing?.('interview', interview.id)}
      />
    );
  };

  const renderAssessmentRow = (assessment) => {
    const candidateName = assessment.candidate?.name ?? 'Unknown candidate';
    const recruiterName = assessment.recruiter?.name ? `Recruiter ${assessment.recruiter.name}` : 'Unassigned recruiter';
    const summary = [assessment.assessmentPlatform, assessment.assessmentType].filter(Boolean).join(' \u2022 ');

    const metaParts = [
      assessment.dueDate ? `Due ${dateFormatter.format(new Date(assessment.dueDate))}` : null,
      assessment.status ? `Status ${humanizeLabel(assessment.status)}` : null,
      assessment.createdAt ? `Logged ${dateTimeFormatter.format(new Date(assessment.createdAt))}` : null,
    ].filter(Boolean);

    return (
      <ApprovalRow
        key={`assessment-${assessment.id}`}
        title={candidateName}
        subtitle={summary || 'Assessment details pending'}
        recruiterLabel={recruiterName}
        meta={metaParts.join(' \u2022 ')}
        isBusy={computeBusy('assessment', assessment.id)}
        onApprove={() => onAction('assessment', assessment.id, 'approve')}
        onReject={() => onAction('assessment', assessment.id, 'reject')}
        enableSelection={Boolean(onToggleSelection)}
        selected={isItemSelected?.('assessments', assessment.id) ?? false}
        onToggleSelect={() => onToggleSelection?.('assessments', assessment.id)}
        selectionDisabled={bulkProcessing || isProcessing?.('assessment', assessment.id)}
      />
    );
  };

  return (
    <Card className="mb-8 space-y-5 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            Pending Approvals
          </h3>
          <p className="text-sm text-muted-foreground">
            Approve or reject submissions before recruiters can make further edits.
          </p>
        </div>
        {filterOptions.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide" htmlFor="pending-approvals-filter">
            Filter
            <select
              id="pending-approvals-filter"
              value={filterValue}
              onChange={(event) => onFilterChange?.(event.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {onSelectedAction ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-xs md:text-sm">
          <div className="flex flex-col gap-1 text-muted-foreground md:flex-row md:items-center md:gap-2">
            {selectionTotals.total > 0 ? (
              <>
                <span className="font-semibold text-foreground">
                  {numberFormatter.format(selectionTotals.total)} selected
                </span>
                <span>
                  {numberFormatter.format(selectionTotals.applications)} applications&nbsp;\u2022&nbsp;
                  {numberFormatter.format(selectionTotals.interviews)} interviews&nbsp;\u2022&nbsp;
                  {numberFormatter.format(selectionTotals.assessments)} assessments
                </span>
              </>
            ) : (
              <span>No items selected.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={selectionTotals.total === 0 || bulkProcessing}
              onClick={() => onSelectedAction('approve')}
            >
              Approve Selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={selectionTotals.total === 0 || bulkProcessing}
              onClick={() => onSelectedAction('reject')}
            >
              Reject Selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              disabled={selectionTotals.total === 0 || bulkProcessing}
              onClick={() => onClearAllSelections?.()}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      ) : null}

      {canBulkAct && hasAny && onBulkAction && hasBulkable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-xs md:text-sm">
          <span className="text-muted-foreground">
            Bulk actions apply to <span className="font-semibold text-foreground">{selectedRecruiterLabel}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={bulkProcessing} onClick={() => onBulkAction('approve')}>
              Approve All
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              disabled={bulkProcessing}
              onClick={() => onBulkAction('reject')}
            >
              Reject All
            </Button>
            {bulkProcessing ? <span className="text-muted-foreground text-xs">Processing...</span> : null}
          </div>
        </div>
      ) : null}

      {hasAny ? (
        <div className="space-y-4">
          {hasApplications ? (
            <PendingSection
              label="Applications"
              count={approvals.applications.length}
              entries={approvals.applications.map(renderApplicationRow)}
              numberFormatter={numberFormatter}
              highlighted={highlightType === 'applications'}
              selectedCount={selectionTotals.applications}
              onSelectAll={() =>
                onSelectAll?.('applications', approvals.applications.map((item) => item.id))
              }
              onClearSelection={() => onClearSelection?.('applications')}
            />
          ) : null}
          {hasInterviews ? (
            <PendingSection
              label="Interviews"
              count={approvals.interviews.length}
              entries={approvals.interviews.map(renderInterviewRow)}
              numberFormatter={numberFormatter}
              highlighted={highlightType === 'interviews'}
              selectedCount={selectionTotals.interviews}
              onSelectAll={() =>
                onSelectAll?.('interviews', approvals.interviews.map((item) => item.id))
              }
              onClearSelection={() => onClearSelection?.('interviews')}
            />
          ) : null}
          {hasAssessments ? (
            <PendingSection
              label="Assessments"
              count={approvals.assessments.length}
              entries={approvals.assessments.map(renderAssessmentRow)}
              numberFormatter={numberFormatter}
              highlighted={highlightType === 'assessments'}
              selectedCount={selectionTotals.assessments}
              onSelectAll={() =>
                onSelectAll?.('assessments', approvals.assessments.map((item) => item.id))
              }
              onClearSelection={() => onClearSelection?.('assessments')}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No pending approvals"
          description={
            filterValue === 'all'
              ? 'All submissions have been reviewed for this range.'
              : 'No pending approvals for the selected recruiter.'
          }
          action={
            filterValue !== 'all' && onFilterChange
              ? (
                <Button type="button" size="sm" variant="outline" onClick={() => onFilterChange('all')}>
                  Show all recruiters
                </Button>
              )
              : null
          }
        />
      )}
    </Card>
  );
};

const RecentApprovalsCard = ({ approvals, dateTimeFormatter }) => {
  const recent = approvals ?? [];
  const decisionStyles = {
    approved: { icon: CheckCircle, badge: 'bg-emerald-50 text-emerald-700', label: 'Approved' },
    rejected: { icon: XCircle, badge: 'bg-red-50 text-red-700', label: 'Rejected' },
    deleted: { icon: XCircle, badge: 'bg-red-50 text-red-700', label: 'Deleted' },
  };

  return (
    <Card className="mb-8 space-y-4 p-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Recent Approval Decisions</h3>
      </div>
      {recent.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No recent approvals"
          description="New approvals and rejections will appear here as they happen."
        />
      ) : (
        <div className="space-y-3">
          {recent.slice(0, 12).map((item) => {
            const meta = decisionStyles[item.decision] ?? {
              icon: CheckCircle,
              badge: 'bg-slate-100 text-slate-700',
              label: humanizeLabel(item.decision),
            };
            const Icon = meta.icon;
            const timestamp = item.createdAt ? dateTimeFormatter.format(new Date(item.createdAt)) : 'â€”';
            const candidateName = item.candidate?.name ?? 'Unknown candidate';
            const recruiterName = item.recruiter?.name ? ` â€¢ ${item.recruiter.name}` : '';
            const actorName = item.actor?.name ?? 'System';

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.entity}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{candidateName}{recruiterName}</p>
                  <p className="text-xs text-muted-foreground">By {actorName}</p>
                </div>
                <p className="text-xs text-muted-foreground md:self-start">{timestamp}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const PendingSection = ({
  label,
  count,
  entries,
  numberFormatter,
  highlighted,
  selectedCount = 0,
  onSelectAll,
  onClearSelection,
}) => {
  const containerClass = highlighted
    ? 'space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 transition'
    : 'space-y-3';
  const showSelectAll = Boolean(onSelectAll) && count > 0;
  const showClear = Boolean(onClearSelection) && selectedCount > 0;
  const showSelectionHelpers = showSelectAll || showClear;
  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground uppercase tracking-wide sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{label}</span>
          <span>{numberFormatter.format(count)} waiting</span>
        </div>
        {showSelectionHelpers ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            {selectedCount > 0 ? (
              <span className="font-semibold text-emerald-600">
                {numberFormatter.format(selectedCount)} selected
              </span>
            ) : null}
            {showSelectAll ? (
              <button
                type="button"
                className="rounded border border-border/60 bg-background px-2 py-1 font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground"
                onClick={onSelectAll}
              >
                Select All
              </button>
            ) : null}
            {showClear ? (
              <button
                type="button"
                className="rounded border border-border/40 px-2 py-1 text-muted-foreground transition hover:text-foreground"
                onClick={onClearSelection}
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">{entries}</div>
    </div>
  );
};

const ApprovalRow = ({
  title,
  subtitle,
  recruiterLabel,
  meta,
  isBusy,
  onApprove,
  onReject,
  enableSelection = false,
  selected = false,
  onToggleSelect,
  selectionDisabled = false,
}) => (
  <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 md:flex-row md:items-center md:justify-between">
    <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-start">
      {enableSelection ? (
        <div className="pt-1 md:pt-0">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            checked={selected}
            disabled={selectionDisabled}
            onChange={() => onToggleSelect?.()}
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        {recruiterLabel ? <p className="text-xs text-muted-foreground">{recruiterLabel}</p> : null}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" disabled={isBusy} onClick={onApprove} className="flex items-center gap-1">
        <Check className="h-4 w-4" />
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50"
        disabled={isBusy}
        onClick={onReject}
      >
        <X className="h-4 w-4" />
        Reject
      </Button>
    </div>
  </div>
);

const KpiCard = ({
  icon,
  title,
  value,
  accent,
  details,
  actionLabel,
  onAction,
  actionDisabled,
  trendData,
  trendLabel,
  trendColor = 'text-primary',
  valueFormatter = numberFormatter,
}) => (
  <Card className="flex flex-col gap-4 p-5">
    <div className="flex items-center gap-3">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{valueFormatter.format(value ?? 0)}</p>
        {details ? <div className="mt-1 text-xs text-muted-foreground">{details}</div> : null}
      </div>
    </div>
    {Array.isArray(trendData) && trendData.length > 1 ? (
      <div className="mt-2">
        <MiniSparkline data={trendData} colorClass={trendColor} />
        {trendLabel ? <p className="mt-1 text-[10px] text-muted-foreground text-right">{trendLabel}</p> : null}
      </div>
    ) : null}
    {actionLabel && onAction ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onAction}
        disabled={actionDisabled}
        className="w-full sm:w-auto"
      >
        {actionLabel}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    ) : null}
  </Card>
);

const MiniSparkline = ({ data, colorClass = 'text-primary' }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const coordinates = data.map((value, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`h-12 w-full ${colorClass}`}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coordinates.join(' ')}
      />
    </svg>
  );
};

const StageChip = ({ label, count, total }) => {
  const stageLabel = label
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const percentage = total > 0 ? count / total : 0;

  return (
    <div className="rounded-lg border border-border bg-background/80 px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{stageLabel}</p>
        <p className="text-xs text-muted-foreground">{numberFormatter.format(count)} candidates</p>
      </div>
      <span className="text-sm font-semibold text-primary">{percentFormatter.format(percentage)}</span>
    </div>
  );
};

const MetricTile = ({ label, value, tone }) => (
  <div className={`rounded-lg px-4 py-3 ${tone ?? 'bg-muted text-foreground'}`}>
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-xl font-semibold text-foreground">{value}</p>
  </div>
);

const RecruiterListItem = ({ recruiter, rangeLabel, rangeDays }) => {
  const quota = Number(recruiter.dailyQuota || recruiter.daily_quota || 0);
  const avgPerDay7 = recruiter.avgApplicationsLast7Days ?? recruiter.avg_apps_last_7 ?? 0;
  const avgPerDay30 = recruiter.avgApplicationsLast30Days ?? recruiter.avg_apps_last_30 ?? 0;
  const applicationsRange =
    recruiter.applicationsRange ??
    recruiter.applications_range ??
    recruiter.applicationsToday ??
    recruiter.applications_today ??
    0;
  const effectiveRangeDays = Math.max(1, rangeDays || 1);
  const expected = quota > 0 ? quota * effectiveRangeDays : 0;
  const diff = applicationsRange - expected;
  const appsClass = quota > 0 && diff < 0 ? 'text-red-600' : 'text-emerald-600';
  const statusClass =
    quota > 0 ? (diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-600' : 'text-muted-foreground') : 'text-muted-foreground';
  const rangeLabelNormalized = rangeLabel || 'Range';
  const statusMessage =
    quota > 0
      ? diff !== 0
        ? `${Math.abs(diff)} ${diff < 0 ? 'below' : 'above'} target (${rangeLabelNormalized})`
        : 'On track'
      : 'No quota set';
  return (
    <div className="flex justify-between items-center px-6 py-3 hover:bg-muted/50 transition cursor-pointer">
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{recruiter.name}</span>
        <span className="text-xs text-muted-foreground">Quota: {quota}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-medium ${appsClass}`}>
          {applicationsRange} / {quota || '\u2014'} Apps ({rangeLabelNormalized})
        </span>
        <span className="text-xs text-muted-foreground">
          7-day avg {avgPerDay7.toFixed(1)} \u2022 30-day avg {avgPerDay30.toFixed(1)}
        </span>
        <span className={`text-xs font-medium ${statusClass}`}>{statusMessage}</span>
      </div>
      <ChevronRight size={18} className="text-muted-foreground ml-4" />
    </div>
  );
};

const UserPresenceRow = ({ user }) => {
  const lastActiveLabel = user.lastActiveAt
    ? dateTimeFormatter.format(new Date(user.lastActiveAt))
    : 'Never active';
  const lastLoginLabel = user.lastLoginAt
    ? dateTimeFormatter.format(new Date(user.lastLoginAt))
    : 'Never logged in';
  const statusClasses = user.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/60';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${statusClasses}`} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {user.name}{' '}
            <span className="text-xs text-muted-foreground">({user.role})</span>
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
        <span className={user.isOnline ? 'text-emerald-600 font-semibold' : ''}>
          {user.isOnline ? 'Online now' : 'Offline'}
        </span>
        <span>Last active {lastActiveLabel}</span>
        <span>Last login {lastLoginLabel}</span>
        <span>
          Notes 7d&nbsp;
          <span className="font-semibold text-foreground">
            {numberFormatter.format(user.notesLast7Days)}
          </span>
          &nbsp;/ total&nbsp;
          <span className="font-semibold text-foreground">
            {numberFormatter.format(user.totalNotes)}
          </span>
        </span>
      </div>
    </div>
  );
};

const NotesSummaryRow = ({ summary }) => {
  const lastNoteLabel = summary.lastNoteAt
    ? dateTimeFormatter.format(new Date(summary.lastNoteAt))
    : 'Never';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{summary.name}</p>
        <p className="text-xs text-muted-foreground">Last note {lastNoteLabel}</p>
      </div>
      <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">
            {numberFormatter.format(summary.totalNotes)}
          </span>{' '}
          total
        </span>
        <span>
          <span className="font-semibold text-foreground">
            {numberFormatter.format(summary.notesLast7Days)}
          </span>{' '}
          7d
        </span>
        {summary.dailyQuota ? (
          <span>Quota {numberFormatter.format(summary.dailyQuota)}</span>
        ) : null}
      </div>
    </div>
  );
};

const ActivityNoteItem = ({ note }) => (
  <div className="rounded-lg border border-border bg-card/60 p-4 shadow-sm">
    <div className="flex justify-between items-center gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {note.author?.name}
          {note.isPrivate && <span className="ml-2 text-xs text-muted-foreground">(Private)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {note.candidateName} \u2022 {dateTimeFormatter.format(new Date(note.createdAt))}
        </p>
      </div>
    </div>
    <p className="mt-3 text-sm leading-relaxed text-foreground">{note.content}</p>
  </div>
);

const ReminderItem = ({ reminder }) => (
  <div className="rounded-lg border border-border bg-amber-50 px-4 py-3 text-xs text-amber-800 flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="font-semibold">{reminder.title}</span>
      <span className="font-medium">
        {dateTimeFormatter.format(new Date(reminder.dueDate))}
      </span>
    </div>
    {reminder.description && <p className="text-amber-700/80">{reminder.description}</p>}
    <div className="flex items-center justify-between text-amber-700/70">
      <span>
        Owner: {reminder.owner?.name ?? 'Unassigned'}
        {reminder.candidate?.name ? ` \u2022 ${reminder.candidate.name}` : ''}
      </span>
      <span>Priority {reminder.priority}</span>
    </div>
  </div>
);

const NotificationReminder = ({ reminder }) => (
  <div className="rounded-md border border-border px-3 py-2 text-sm bg-muted/40">
    <div className="flex items-center justify-between">
      <span className="font-medium text-foreground">{reminder.title}</span>
      <span className="text-xs text-muted-foreground">
        {dateTimeFormatter.format(new Date(reminder.dueDate))}
      </span>
    </div>
    {reminder.description && <p className="text-xs text-muted-foreground mt-1">{reminder.description}</p>}
    <p className="text-xs text-muted-foreground mt-1">
      {reminder.owner?.name ?? 'Unassigned'}
      {reminder.candidate?.name ? ` \u2022 ${reminder.candidate.name}` : ''}
    </p>
  </div>
);

const NotificationAlert = ({ alert }) => (
  <div className="rounded-md border border-border px-3 py-2 text-sm bg-muted/40">
    <div className="flex items-center justify-between">
      <span className="font-medium text-foreground">{alert.title}</span>
      <span className="text-xs text-muted-foreground">{alert.type}</span>
    </div>
    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
    <p className="text-xs text-muted-foreground mt-1">
      Owner: {alert.owner?.name ?? 'Unassigned'} \u2022 Priority {alert.priority}
    </p>
  </div>
);

export async function getServerSideProps() {
  return {
    props: {
      now: new Date().toISOString(),
    },
  };
}

export default AdminDashboard;






