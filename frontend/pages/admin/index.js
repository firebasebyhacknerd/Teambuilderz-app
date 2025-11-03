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
import {
  useAdminOverviewQuery,
  useAdminActivityQuery,
  useNotificationsQuery,
  useUserActivityQuery,
} from '../../lib/queryHooks';
import API_URL from '../../lib/api';
import { formatLabel } from '../../lib/formatting';

const numberFormatter = new Intl.NumberFormat();
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

const AdminDashboard = () => {
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
  const rangeConfig = useMemo(() => {
    const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[0];
    const today = new Date();
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
  }, [range, rangeOptions]);
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
  };
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
    } catch (error) {
      console.error('Bulk approval action failed:', error);
    } finally {
      setApprovalAction(null);
    }
  };

  const sidebarLinks = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/candidates', label: 'Candidates', icon: Users },
    { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
    { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { href: '/profile', label: 'My Profile', icon: CircleUser },
  ];

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
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
              <p className="text-sm text-muted-foreground col-span-2">No candidate pipeline data available.</p>
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
            <p className="p-4 text-sm text-muted-foreground">No recruiter productivity data found.</p>
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
            <p className="text-sm text-muted-foreground">No users found.</p>
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
            <p className="text-sm text-muted-foreground">No recruiter note activity recorded yet.</p>
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
            <p className="text-sm text-muted-foreground">No recent notes logged.</p>
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
            <p className="text-sm text-muted-foreground">No active reminders scheduled.</p>
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
            <p className="text-sm text-muted-foreground">No recruiter notes logged yet.</p>
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
              <p className="text-sm text-muted-foreground">No pending reminders.</p>
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
              <p className="text-sm text-muted-foreground">All clear! No open alerts.</p>
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
            />
          ) : null}
          {hasInterviews ? (
            <PendingSection
              label="Interviews"
              count={approvals.interviews.length}
              entries={approvals.interviews.map(renderInterviewRow)}
              numberFormatter={numberFormatter}
              highlighted={highlightType === 'interviews'}
            />
          ) : null}
          {hasAssessments ? (
            <PendingSection
              label="Assessments"
              count={approvals.assessments.length}
              entries={approvals.assessments.map(renderAssessmentRow)}
              numberFormatter={numberFormatter}
              highlighted={highlightType === 'assessments'}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {filterValue === 'all'
            ? 'All clear\u2014no pending approvals for this range.'
            : 'No pending approvals for the selected recruiter in this range.'}
        </p>
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
        <p className="text-sm text-muted-foreground">
          No approval activity recorded for this range.
        </p>
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

const PendingSection = ({ label, count, entries, numberFormatter, highlighted }) => {
  const containerClass = highlighted
    ? 'space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 transition'
    : 'space-y-3';
  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wide">
        <span className="font-semibold">{label}</span>
        <span>{numberFormatter.format(count)} waiting</span>
      </div>
      <div className="space-y-3">{entries}</div>
    </div>
  );
};

const ApprovalRow = ({ title, subtitle, recruiterLabel, meta, isBusy, onApprove, onReject }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      {recruiterLabel ? <p className="text-xs text-muted-foreground">{recruiterLabel}</p> : null}
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

const KpiCard = ({ icon, title, value, accent, details, actionLabel, onAction, actionDisabled }) => (
  <Card className="flex flex-col gap-4 p-5">
    <div className="flex items-center gap-3">
      <div className={`h-11 w-11 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{numberFormatter.format(value ?? 0)}</p>
        {details ? <div className="mt-1 text-xs text-muted-foreground">{details}</div> : null}
      </div>
    </div>
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

export default AdminDashboard;





