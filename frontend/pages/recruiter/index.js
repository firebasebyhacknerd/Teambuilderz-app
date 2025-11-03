import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { UserCheck, ChevronRight, LogOut, Users, FileText, AlertTriangle, CircleUser, Home, TrendingUp, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';
import { useRecruiterProfileQuery, useNotificationsQuery } from '../../lib/queryHooks';

const DAILY_TARGET = 60;
const numberFormatter = new Intl.NumberFormat();
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const humanize = (value) => {
  if (!value) {
    return '';
  }
  return String(value)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const RecruiterDashboard = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [monthlyAvg, setMonthlyAvg] = useState(0);
  const [userName, setUserName] = useState('Recruiter');

  const totalAppsToday = useMemo(
    () => candidates.reduce((sum, c) => sum + parseInt(c.daily_applications || 0, 10), 0),
    [candidates]
  );
  const progressPercent = Math.min(100, (totalAppsToday / DAILY_TARGET) * 100);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    const storedName = localStorage.getItem('userName');
    const storedUserId = localStorage.getItem('userId');

    if (!storedToken) {
      router.push('/login');
      return;
    }

    if (storedRole && storedRole !== 'Recruiter') {
      router.replace(storedRole === 'Admin' ? '/admin' : '/login');
      return;
    }

    setToken(storedToken);

    if (storedUserId) {
      const parsedId = Number(storedUserId);
      if (!Number.isNaN(parsedId)) {
        setUserId(parsedId);
      }
    }

    if (storedName) {
      setUserName(storedName);
    }

    const headers = { Authorization: `Bearer ${storedToken}` };

    const fetchCandidates = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/candidates`, { headers });
        if (response.status === 401 || response.status === 403) {
          router.push('/login');
          return;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch candidates.');
        }
        setCandidates(await response.json());
      } catch (error) {
        console.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchAverages = async () => {
      try {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        const weekFrom = weekAgo.toISOString().split('T')[0];
        const weekTo = today.toISOString().split('T')[0];
        const monthFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const monthTo = today.toISOString().split('T')[0];

        const [weekRes, monthRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, { headers }),
          fetch(`${API_URL}/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, { headers })
        ]);

        const [weekData, monthData] = await Promise.all([weekRes.json(), monthRes.json()]);
        const matchingName = storedName || '';
        const weekRec = Array.isArray(weekData) ? weekData.find((r) => r.recruiter_name === matchingName) : null;
        const monthRec = Array.isArray(monthData) ? monthData.find((r) => r.recruiter_name === matchingName) : null;
        setWeeklyAvg(weekRec ? Math.round(weekRec.avg_apps_per_day || 0) : 0);
        setMonthlyAvg(monthRec ? Math.round(monthRec.avg_apps_per_day || 0) : 0);
      } catch (error) {
        setWeeklyAvg(0);
        setMonthlyAvg(0);
      }
    };

    setLoading(true);
    fetchCandidates();
    fetchAverages();
  }, [router]);

  const metricsEnabled = Boolean(token) && typeof userId === 'number';
  const { data: notificationsData } = useNotificationsQuery(token, metricsEnabled);
  const [toastAlert, setToastAlert] = useState(null);
  const [lastAlertKey, setLastAlertKey] = useState(null);
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
  } = useRecruiterProfileQuery(token, userId, undefined, metricsEnabled);

  useEffect(() => {
    if (profileError) {
      console.error('Unable to load recruiter metrics.');
    }
  }, [profileError]);

  useEffect(() => {
    if (!notificationsData?.alerts || notificationsData.alerts.length === 0) {
      return;
    }
    const openAlerts = notificationsData.alerts.filter(
      (alert) => alert.status !== 'resolved' && alert.alert_type === 'submission_rejected',
    );
    if (openAlerts.length === 0) {
      return;
    }
    const newest = openAlerts[0];
    const key = `${newest.id}-${newest.status}-${newest.updated_at ?? newest.created_at ?? ''}`;
    if (!lastAlertKey) {
      setLastAlertKey(key);
      return;
    }
    if (key !== lastAlertKey) {
      setLastAlertKey(key);
      setToastAlert(newest);
    }
  }, [notificationsData?.alerts, lastAlertKey]);

  const metricsLoading = metricsEnabled && profileLoading;
  const applicationMetrics = profileData?.metrics?.applications ?? {
    total: 0,
    approved: 0,
    pending: 0,
  };
  const applicationsTodayMetrics = profileData?.metrics?.applicationsToday ?? {
    total: 0,
    approved: 0,
    pending: 0,
  };
  const interviewMetrics = profileData?.metrics?.interviews ?? {
    total: 0,
    approved: 0,
    pending: 0,
  };
  const assessmentMetrics = profileData?.metrics?.assessments ?? {
    total: 0,
    approved: 0,
    pending: 0,
  };
  const pendingApplications = useMemo(() => {
    const items = profileData?.recentApplications?.items ?? [];
    return items.filter((item) => !item.isApproved);
  }, [profileData]);
  const pendingInterviews = useMemo(() => {
    const items = profileData?.upcomingInterviews?.items ?? [];
    return items.filter((item) => !item.isApproved);
  }, [profileData]);
  const pendingAssessments = useMemo(() => {
    const items = profileData?.pendingAssessments?.items ?? [];
    return items.filter((item) => !item.isApproved);
  }, [profileData]);
  const pendingLists = useMemo(
    () => ({
      applications: pendingApplications,
      interviews: pendingInterviews,
      assessments: pendingAssessments,
    }),
    [pendingApplications, pendingInterviews, pendingAssessments],
  );
  const pendingSummary = useMemo(
    () => ({
      applications: Number(applicationMetrics.pending || 0),
      interviews: Number(interviewMetrics.pending || 0),
      assessments: Number(assessmentMetrics.pending || 0),
    }),
    [applicationMetrics.pending, interviewMetrics.pending, assessmentMetrics.pending],
  );

  const handlePendingItemNavigate = (candidateId) => {
    if (!candidateId) {
      return;
    }
    router.push(`/recruiter/candidate/${candidateId}`);
  };

  const handleToastDismiss = () => {
    setToastAlert(null);
  };

  const handleToastView = () => {
    setToastAlert(null);
    router.push('/alerts');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    router.push('/login');
  };

  const sidebarLinks = [
    { href: '/recruiter', label: 'Dashboard', icon: Home },
    { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { href: '/profile', label: 'My Profile', icon: CircleUser },
  ];

  if (loading || metricsLoading) {
    return (
      <DashboardLayout title="Recruiter Dashboard" subtitle={`Welcome back, ${userName}`} links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading dashboard...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Recruiter Dashboard"
      subtitle={`Welcome back, ${userName}`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} />
          Logout
        </Button>
      }
    >
      {toastAlert ? (
        <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">Submission Rejected</p>
                <p className="text-xs text-amber-800">
                  {toastAlert.message || 'An admin rejected one of your submissions. Review the details to resubmit.'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleToastDismiss}>
                Dismiss
              </Button>
              <Button size="sm" onClick={handleToastView}>
                View Alerts
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <UserCheck className="text-primary h-6 w-6" />
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Daily Application Target</p>
              <h2 className="text-2xl font-semibold text-foreground">Today&apos;s Progress</h2>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <ProgressRing percentage={progressPercent} value={totalAppsToday} target={DAILY_TARGET} />
            <p className="text-center text-muted-foreground">
              You have logged{' '}
              <span className="font-semibold text-primary">{totalAppsToday}</span> of{' '}
              <span className="font-semibold">{DAILY_TARGET}</span> applications required today.
            </p>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
              <HighlightCard title="Weekly Avg Apps/Day" value={weeklyAvg} tone="from-yellow-100 to-yellow-200" />
              <HighlightCard title="Monthly Avg Apps/Day" value={monthlyAvg} tone="from-pink-100 to-pink-200" />
            </div>
            {metricsEnabled ? (
              <div className="w-full space-y-4">
                <TodayBreakdownCard title="Applications Logged Today" metrics={applicationsTodayMetrics} />
                <PendingApprovalsBanner pending={pendingSummary} />
                <PendingItemsPanel
                  pending={pendingLists}
                  onNavigate={handlePendingItemNavigate}
                  numberFormatter={numberFormatter}
                  dateTimeFormatter={dateTimeFormatter}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MetricBreakdown label="Total Applications" metrics={applicationMetrics} />
                  <MetricBreakdown label="Total Interviews" metrics={interviewMetrics} />
                  <MetricBreakdown label="Total Assessments" metrics={assessmentMetrics} />
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">My Candidates</h2>
            <p className="text-xs text-muted-foreground">Quick access to your active pipeline</p>
          </div>
          <div className="divide-y divide-border">
            {candidates.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No candidates assigned yet.</p>
            ) : (
              candidates.map((candidate) => (
                <CandidateListItem
                  key={candidate.id}
                  candidate={candidate}
                  onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const HighlightCard = ({ title, value, tone }) => (
  <div className={`rounded-lg bg-gradient-to-br ${tone} px-4 py-3 text-center shadow-sm`}>
    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
    <span className="text-xl font-semibold text-foreground">{value}</span>
  </div>
);

const TodayBreakdownCard = ({ title, metrics }) => {
  const total = Number(metrics?.total || 0);
  const approved = Number(metrics?.approved || 0);
  const pending = Number(metrics?.pending || 0);

  return (
    <div className="rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">Approved requests are locked for editing</p>
        </div>
        <span className="text-lg font-semibold text-foreground">
          {numberFormatter.format(total)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-emerald-600">
          Approved {numberFormatter.format(approved)}
        </span>
        <span className="text-muted-foreground">{'\u2022'}</span>
        <span className={`font-semibold ${pending > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
          Pending {numberFormatter.format(pending)}
        </span>
      </div>
    </div>
  );
};

const PendingApprovalsBanner = ({ pending }) => {
  const totalPending = Number(pending.applications || 0) + Number(pending.interviews || 0) + Number(pending.assessments || 0);
  if (totalPending === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm text-amber-800 text-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-amber-900">Pending Admin Approval</p>
          <p className="text-xs text-amber-700">
            Approved items are locked. Reach out to your admin if these need attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <span>
            Applications{' '}
            <span className="text-amber-900">{numberFormatter.format(Number(pending.applications || 0))}</span>
          </span>
          <span>
            Interviews{' '}
            <span className="text-amber-900">{numberFormatter.format(Number(pending.interviews || 0))}</span>
          </span>
          <span>
            Assessments{' '}
            <span className="text-amber-900">{numberFormatter.format(Number(pending.assessments || 0))}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

const PendingItemsPanel = ({ pending, onNavigate, numberFormatter, dateTimeFormatter }) => {
  const sections = [
    {
      key: 'applications',
      label: 'Applications',
      items: pending.applications ?? [],
      empty: 'No pending applications.',
      mapItem: (item) => {
        const submittedOn = item.applicationDate || item.createdAt;
        const metaParts = [
          submittedOn ? `Submitted ${dateTimeFormatter.format(new Date(submittedOn))}` : null,
          item.status ? `Status ${humanize(item.status)}` : null,
          item.applicationsCount
            ? `${numberFormatter.format(item.applicationsCount)} ${item.applicationsCount === 1 ? 'app' : 'apps'}`
            : null,
        ].filter(Boolean);
        return {
          id: item.id,
          candidateId: item.candidateId,
          title: item.candidateName ?? 'Unknown candidate',
          subtitle: [item.companyName, item.jobTitle].filter(Boolean).join(' \u2022 '),
          meta: metaParts.join(' \u2022 '),
        };
      },
    },
    {
      key: 'interviews',
      label: 'Interviews',
      items: pending.interviews ?? [],
      empty: 'No pending interviews.',
      mapItem: (item) => {
        const metaParts = [
          item.scheduledDate ? `Scheduled ${dateTimeFormatter.format(new Date(item.scheduledDate))}` : null,
          item.status ? `Status ${humanize(item.status)}` : null,
        ].filter(Boolean);
        return {
          id: item.id,
          candidateId: item.candidateId,
          title: item.candidateName ?? 'Unknown candidate',
          subtitle: [item.companyName, humanize(item.interviewType)].filter(Boolean).join(' \u2022 '),
          meta: metaParts.join(' \u2022 '),
        };
      },
    },
    {
      key: 'assessments',
      label: 'Assessments',
      items: pending.assessments ?? [],
      empty: 'No pending assessments.',
      mapItem: (item) => {
        const metaParts = [
          item.dueDate ? `Due ${dateTimeFormatter.format(new Date(item.dueDate))}` : null,
          item.status ? `Status ${humanize(item.status)}` : null,
        ].filter(Boolean);
        return {
          id: item.id,
          candidateId: item.candidateId,
          title: item.candidateName ?? 'Unknown candidate',
          subtitle: [item.assessmentPlatform, item.assessmentType].filter(Boolean).join(' \u2022 '),
          meta: metaParts.join(' \u2022 '),
        };
      },
    },
  ];

  const hasAny = sections.some((section) => section.items.length > 0);
  if (!hasAny) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background/80 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Clock className="h-4 w-4 text-primary" />
        Awaiting Admin Review
      </div>
      {sections.map((section) => (
        <PendingItemsSection
          key={section.key}
          label={section.label}
          items={section.items}
          emptyMessage={section.empty}
          mapItem={section.mapItem}
          onNavigate={onNavigate}
          numberFormatter={numberFormatter}
        />
      ))}
    </div>
  );
};

const PendingItemsSection = ({ label, items, emptyMessage, mapItem, onNavigate, numberFormatter }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
      <span className="font-semibold text-foreground">{label}</span>
      <span>{numberFormatter.format(items.length)} waiting</span>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyMessage}</p>
    ) : (
      <div className="space-y-2">
        {items.map((item) => {
          const mapped = mapItem(item);
          return (
            <PendingItemRow
              key={`${label}-${mapped.id}`}
              title={mapped.title}
              subtitle={mapped.subtitle}
              meta={mapped.meta}
              candidateId={mapped.candidateId}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    )}
  </div>
);

const PendingItemRow = ({ title, subtitle, meta, candidateId, onNavigate }) => (
  <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-3 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
    </div>
    <div className="md:self-start">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onNavigate?.(candidateId)}
        disabled={!candidateId}
      >
        View
      </Button>
    </div>
  </div>
);

const MetricBreakdown = ({ label, metrics }) => {
  const total = Number(metrics?.total || 0);
  const approved = Number(metrics?.approved || 0);
  const pending = Number(metrics?.pending || 0);

  return (
    <div className="rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{numberFormatter.format(total)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-emerald-600">
          Approved {numberFormatter.format(approved)}
        </span>
        <span className="text-muted-foreground">{'\u2022'}</span>
        <span className={`font-semibold ${pending > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
          Pending {numberFormatter.format(pending)}
        </span>
      </div>
    </div>
  );
};

const CandidateListItem = ({ candidate, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between px-6 py-3 hover:bg-accent transition text-left"
  >
    <div>
      <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
      <p className="text-xs text-muted-foreground">{candidate.technology_primary || 'N/A'}</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-primary">{candidate.daily_applications || 0} Apps Today</span>
      <ChevronRight size={18} className="text-muted-foreground" />
    </div>
  </button>
);

const ProgressRing = ({ percentage, value, target }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg className="w-40 h-40 transform -rotate-90 text-primary">
      <circle
        className="text-muted stroke-current"
        strokeWidth="10"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="80"
        cy="80"
      />
      <circle
        className="stroke-current transition-all duration-1000 ease-in-out"
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx="80"
        cy="80"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="text-3xl font-semibold text-foreground rotate-90 transform translate-x-[-8px]"
      >
        {Math.round(percentage)}%
      </text>
      <text
        x="50%"
        y="68%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="text-xs text-muted-foreground rotate-90 transform translate-x-[-8px]"
      >
        {value}/{target}
      </text>
    </svg>
  );
};

export default RecruiterDashboard;






