import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import {
  UserCheck,
  ChevronRight,
  LogOut,
  Users,
  FileText,
  AlertTriangle,
  CircleUser,
  Home,
  TrendingUp,
  Clock,
  CalendarCheck,
  CheckCircle2,
  Sunrise,
  Plane,
  Ban,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';
import PDFExportButton from '../../components/ui/pdf-export-button';
import {
  useRecruiterProfileQuery,
  useNotificationsQuery,
  useAttendanceQuery,
  useSubmitAttendanceMutation,
} from '../../lib/queryHooks';
import { emitRefresh, useRefreshListener, REFRESH_CHANNELS } from '../../lib/refreshBus';

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

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) {
    return '';
  }
  const absolute = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (mins > 0) {
    parts.push(`${mins}m`);
  }
  if (parts.length === 0) {
    return '0m';
  }
  return parts.join(' ');
};

const attendanceStatusTone = {
  present: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  'half-day': 'bg-amber-50 text-amber-800 border border-amber-200',
  absent: 'bg-red-100 text-red-800 border border-red-200',
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  unmarked: 'bg-slate-100 text-slate-700 border border-slate-200',
  rejected: 'bg-rose-100 text-rose-800 border border-rose-200',
};

const attendanceStatusOptions = [
  { value: 'present', label: 'Present', desc: 'Full day', icon: CheckCircle2, tone: 'text-emerald-700', locked: true },
  { value: 'half-day', label: 'Half Day', desc: 'Partial', icon: Sunrise, tone: 'text-amber-700', locked: true },
  { value: 'leave', label: 'Leave', desc: 'Planned', icon: Plane, tone: 'text-blue-700', locked: false },
  { value: 'absent', label: 'Absent', desc: 'Unplanned', icon: Ban, tone: 'text-rose-700', locked: true },
];

const leaveCategoryOptions = [
  { value: 'cl', label: 'Casual Leave (CL)' },
  { value: 'sl', label: 'Sick Leave (SL)' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'lwp', label: 'Loss of Pay (LWP)' },
];

const HALF_DAY_REASON_LABELS = {
  'late-login': 'Late login past 8:00 PM IST',
  'early-logout': 'Logged out more than 2 hours before shift end',
  'reported-half-day': 'Half-day reported',
};

const STATUS_LOCK_MESSAGE = 'Shift attendance is recorded by admins. Use this form only to request leave.';
const POLICY_DOC_URL = 'https://intranet.teambuilderz/policies/attendance';
const POLICY_TIPS = [
  'Login by 7:00 PM IST. Arriving after 8:00 PM counts as a half-day.',
  'Logout within two hours of shift end to avoid another half-day.',
  'Weekend auto-present can turn into sandwich leave if Friday and Monday are absences.',
  'Uninformed leave results in a full-day salary deduction.',
];

const RecruiterDashboard = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [monthlyAvg, setMonthlyAvg] = useState(0);
  const [userName, setUserName] = useState('Recruiter');
  const [attendanceStatus, setAttendanceStatus] = useState('leave');
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const monthStartIso = useMemo(() => {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return start.toISOString().split('T')[0];
  }, []);
  const [attendanceMessage, setAttendanceMessage] = useState(null);
  const [informedLeave, setInformedLeave] = useState(false);
  const [leaveCategory, setLeaveCategory] = useState('');

  const totalAppsToday = useMemo(
    () => candidates.reduce((sum, c) => sum + parseInt(c.daily_applications || 0, 10), 0),
    [candidates]
  );
  const progressPercent = Math.min(100, (totalAppsToday / DAILY_TARGET) * 100);
  const nextActionMessage = useMemo(() => {
    const remaining = Math.max(0, DAILY_TARGET - totalAppsToday);
    if (remaining === 0) {
      return 'Daily target met – keep logging to boost weekly average.';
    }
    if (remaining <= 5) {
      return 'Almost there! Log a few more applications to secure your quota.';
    }
    return `Log ${remaining} more applications to hit today’s target.`;
  }, [totalAppsToday]);

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
  }, [router]);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : null),
    [token],
  );

  const fetchCandidates = useCallback(async () => {
    if (!authHeaders) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/v1/candidates`, { headers: authHeaders });
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
    }
  }, [authHeaders, router]);

  const fetchPerformance = useCallback(async () => {
    if (!authHeaders) {
      return;
    }
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      const weekFrom = weekAgo.toISOString().split('T')[0];
      const weekTo = today.toISOString().split('T')[0];
      const monthFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const monthTo = today.toISOString().split('T')[0];

      const [weekRes, monthRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/reports/performance?date_from=${weekFrom}&date_to=${weekTo}`, { headers: authHeaders }),
        fetch(`${API_URL}/api/v1/reports/performance?date_from=${monthFrom}&date_to=${monthTo}`, { headers: authHeaders }),
      ]);

      const [weekData, monthData] = await Promise.all([weekRes.json(), monthRes.json()]);
      const matchingName = userName || '';
      const weekRec = Array.isArray(weekData) ? weekData.find((r) => r.recruiter_name === matchingName) : null;
      const monthRec = Array.isArray(monthData) ? monthData.find((r) => r.recruiter_name === matchingName) : null;
      setWeeklyAvg(weekRec ? Math.round(weekRec.avg_apps_per_day || 0) : 0);
      setMonthlyAvg(monthRec ? Math.round(monthRec.avg_apps_per_day || 0) : 0);
    } catch (error) {
      setWeeklyAvg(0);
      setMonthlyAvg(0);
    }
  }, [authHeaders, userName]);

  useEffect(() => {
    if (!token || !authHeaders) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCandidates(), fetchPerformance()]);
      if (!cancelled) {
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, fetchCandidates, fetchPerformance, token]);

  useRefreshListener(REFRESH_CHANNELS.CANDIDATES, fetchCandidates);
  useRefreshListener(REFRESH_CHANNELS.PERFORMANCE, fetchPerformance);
  useRefreshListener(REFRESH_CHANNELS.DASHBOARD, fetchPerformance);

  const metricsEnabled = Boolean(token) && typeof userId === 'number';
  const attendanceQueryParams = useMemo(
    () => ({
      date_from: monthStartIso,
      date_to: todayIso,
    }),
    [monthStartIso, todayIso],
  );
  const {
    data: attendanceData,
    isFetching: attendanceLoading,
  } = useAttendanceQuery(token, attendanceQueryParams, Boolean(token));
  const submitAttendance = useSubmitAttendanceMutation(token);
  const { data: notificationsData } = useNotificationsQuery(token, metricsEnabled);
  const [toastAlert, setToastAlert] = useState(null);
  const [lastAlertKey, setLastAlertKey] = useState(null);
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
  } = useRecruiterProfileQuery(token, userId, undefined, metricsEnabled);

  useEffect(() => {
    if (!attendanceMessage) {
      return undefined;
    }
    const timer = setTimeout(() => setAttendanceMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [attendanceMessage]);

  useEffect(() => {
    if (profileError) {
      console.error('Unable to load recruiter metrics.');
    }
  }, [profileError]);

  const todayAttendance = useMemo(() => {
    if (!attendanceData?.days) {
      return null;
    }
    return attendanceData.days.find((day) => day.date === todayIso) || null;
  }, [attendanceData, todayIso]);

  useEffect(() => {
    if (!todayAttendance || todayAttendance.reportedStatus !== 'leave') {
      setLeaveCategory('');
      setInformedLeave(false);
      return;
    }
    setLeaveCategory(todayAttendance.leaveCategory || '');
    setInformedLeave(Boolean(todayAttendance.informedLeave));
  }, [todayAttendance]);

  const attendanceEffective = todayAttendance?.effectiveStatus ?? 'unmarked';
  const attendanceApproval = todayAttendance?.approvalStatus ?? (todayAttendance ? 'pending' : 'not-submitted');
  const attendanceDisplayStatus = attendanceEffective === 'unmarked' ? 'not-submitted' : attendanceEffective;
  const policyImpact = todayAttendance?.policyImpact ?? null;
  const policyWarnings = useMemo(() => {
    if (!policyImpact) {
      return [];
    }
    const warnings = [];
    if (policyImpact.lateLoginMinutes) {
      warnings.push(`Late login by ${formatDuration(policyImpact.lateLoginMinutes)}.`);
    }
    if (policyImpact.earlyLogoutMinutes) {
      warnings.push(`Early logout by ${formatDuration(policyImpact.earlyLogoutMinutes)}.`);
    }
    if (policyImpact.breakOverMinutes) {
      warnings.push(`Break exceeded by ${formatDuration(policyImpact.breakOverMinutes)}.`);
    }
    if (policyImpact.uninformedLeave) {
      warnings.push('Uninformed leave recorded. Full-day deduction applies.');
    }
    if (policyImpact.halfDay && policyImpact.halfDayReasons?.length) {
      const reasonText = policyImpact.halfDayReasons
        .map((reason) => HALF_DAY_REASON_LABELS[reason] || humanize(reason))
        .join(', ');
      warnings.push(`Half-day counted (${reasonText}).`);
    }
    return warnings;
  }, [policyImpact]);
  const isApprovedFullPresent =
    Boolean(todayAttendance) &&
    todayAttendance.effectiveStatus === 'present' &&
    (todayAttendance.approvalStatus === 'approved' || todayAttendance.approvalStatus === 'auto');
  const attendanceStatusDetail = useMemo(() => {
    if (!todayAttendance) {
      return 'Submit attendance once you start your day.';
    }
    if (todayAttendance.approvalStatus === 'auto') {
      return 'Weekend attendance is auto-marked as present.';
    }
    if (todayAttendance.approvalStatus === 'sandwich') {
      return 'Weekend counted as leave because Friday and Monday are approved absences.';
    }
    if (policyImpact?.halfDay && policyImpact?.halfDayReasons?.length) {
      const reasonText = policyImpact.halfDayReasons
        .map((reason) => HALF_DAY_REASON_LABELS[reason] || humanize(reason))
        .join(', ');
      return `Company policy marked this as a half-day (${reasonText}).`;
    }
    if (policyImpact?.lateLoginMinutes || policyImpact?.earlyLogoutMinutes) {
      return 'Shift timing breach detected. Admin will review your submission.';
    }
    if (policyImpact?.uninformedLeave) {
      return 'Marked as uninformed leave. HR will review for salary deduction.';
    }
    if (todayAttendance.approvalStatus === 'pending') {
      if (todayAttendance.reportedStatus === 'half-day') {
        return 'Half day submitted; waiting for admin approval.';
      }
      return 'Waiting for admin approval. You can resubmit if needed.';
    }
    if (todayAttendance.approvalStatus === 'approved') {
      if (todayAttendance.reportedStatus === 'present') {
        return 'Admin approved your presence for today.';
      }
      if (todayAttendance.reportedStatus === 'half-day') {
        return 'Admin approved a half day for today.';
      }
      return 'Admin marked today as leave.';
    }
    if (todayAttendance.approvalStatus === 'rejected') {
      return 'Submission rejected. Submit again if you were present.';
    }
    return 'Attendance requires attention.';
  }, [todayAttendance, policyImpact]);
  const requiresLeaveType = attendanceStatus === 'leave';
  const leaveRequiresNotice = attendanceStatus === 'leave';
  const statusLocked = attendanceStatus !== 'leave';
  const missingLeaveType = requiresLeaveType && !leaveCategory;
  const submitAttendanceDisabled = submitAttendance.isPending || statusLocked || missingLeaveType;
  const leaveHistory = useMemo(() => {
    if (!attendanceData?.records) {
      return [];
    }
    return attendanceData.records
      .filter((record) => record.reportedStatus === 'leave')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [attendanceData?.records]);

  const handleAttendanceSubmit = () => {
    if (attendanceStatus !== 'leave') {
      toast.error('Only leave requests can be submitted. Contact your admin for attendance updates.');
      return;
    }
    setAttendanceMessage(null);
    const payload = {
      attendance_date: todayIso,
      status: 'leave',
    };
    payload.leave_category = leaveCategory;
    if (leaveRequiresNotice) {
      payload.informed_leave = informedLeave;
    }
    submitAttendance.mutate(
      payload,
      {
        onSuccess: () => {
          setAttendanceMessage({
            type: 'success',
            text: `Submitted ${humanize(attendanceStatus)} for admin approval.`,
          });
          toast.success(`Submitted ${humanize(attendanceStatus)}`);
          setAttendanceStatus('leave');
          emitRefresh(REFRESH_CHANNELS.ATTENDANCE);
          emitRefresh(REFRESH_CHANNELS.DASHBOARD);
        },
        onError: (error) => {
          setAttendanceMessage({ type: 'error', text: error.message || 'Unable to submit attendance.' });
          toast.error(error.message || 'Unable to submit attendance.');
        },
      },
    );
  };

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
        <div className="flex gap-2">
          <PDFExportButton
            reportType="candidates"
            data={{
              stage: undefined,
              dateFrom: undefined,
              dateTo: undefined
            }}
            filename="dashboard-candidates-report"
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
      {toastAlert ? (
        <div className="fixed top-4 right-4 z-50 w-full max-w-sm" role="status" aria-live="assertive">
          <div className="group overflow-hidden rounded-xl border border-amber-400/30 bg-amber-500/10 shadow-lg shadow-black/10 ring-1 ring-black/5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-amber-700 shadow-inner">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">Submission Rejected</p>
                <p className="text-xs leading-relaxed text-amber-800">
                  {toastAlert.message || 'An admin rejected one of your submissions. Review the details to resubmit.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleToastDismiss} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                Dismiss
              </Button>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 pb-3">
              <Button size="sm" onClick={handleToastView} className="gap-2">
                View Alerts
              </Button>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-amber-400/60 to-transparent" />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-gradient-to-r from-primary/90 via-primary to-primary/80 text-primary-foreground p-4 sm:p-5 shadow-lg shadow-primary/20">
          <div className="text-xs uppercase tracking-wide opacity-80">Attendance</div>
          <div className="text-2xl font-semibold mt-1">{humanize(attendanceDisplayStatus)}</div>
          <div className="text-sm opacity-80 mt-1">
            {todayAttendance ? (attendanceApproval === 'auto' ? 'Weekend auto present' : `Admin: ${attendanceApproval}`) : 'Not submitted yet'}
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-emerald-500/90 via-emerald-500 to-emerald-600 text-white p-4 sm:p-5 shadow-lg shadow-emerald-500/20">
          <div className="text-xs uppercase tracking-wide opacity-90">Today&apos;s Applications</div>
          <div className="text-2xl font-semibold mt-1">{totalAppsToday} / {DAILY_TARGET}</div>
          <div className="text-sm opacity-90 mt-1">{Math.round(progressPercent)}% of daily target</div>
          <p className="mt-2 text-xs text-emerald-100">{nextActionMessage}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-amber-400/90 via-amber-400 to-amber-500 text-amber-950 p-4 sm:p-5 shadow-lg shadow-amber-400/30">
          <div className="text-xs uppercase tracking-wide opacity-90">Alerts</div>
          <div className="text-2xl font-semibold mt-1">{notificationsData?.alerts?.length ?? 0}</div>
          <div className="text-sm opacity-90 mt-1 flex items-center gap-2">
            <span>Pending attention</span>
            <Button size="sm" variant="outline" className="border-amber-700/40 text-amber-900 bg-white/70 hover:bg-white" onClick={handleToastView}>
              View
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card id="leave-card" className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={`capitalize ${attendanceStatusTone[attendanceEffective] ?? 'bg-slate-100 text-slate-700 border border-slate-200'}`}
            >
              {humanize(attendanceDisplayStatus)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {attendanceLoading
                ? 'Refreshing status.'
                : todayAttendance
                  ? attendanceApproval === 'auto'
                    ? 'Weekend auto present'
                    : attendanceApproval === 'sandwich'
                      ? 'Sandwich leave applied'
                      : `Admin status: ${attendanceApproval}`
                  : 'No submission yet.'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Select today&apos;s status</p>
              <span className="text-[11px] text-muted-foreground/80">Sent for approval</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {attendanceStatusOptions.map((option) => {
                const Icon = option.icon;
                const isActive = attendanceStatus === option.value;
                const isLocked = option.locked;
                const buttonClasses = [
                  'group relative overflow-hidden rounded-lg border text-left transition-all duration-200',
                  isActive ? 'border-primary/60 bg-primary/10 shadow-sm shadow-primary/10 scale-[1.01]' : 'border-border',
                  isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/30 hover:bg-primary/5',
                ].join(' ');
                const handleClick = () => {
                  if (isLocked) {
                    toast(STATUS_LOCK_MESSAGE);
                    return;
                  }
                  setAttendanceStatus(option.value);
                };
                return (
                  <button key={option.value} type="button" onClick={handleClick} className={buttonClasses} disabled={isLocked}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span
                        className={`rounded-full bg-white/80 p-1 ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105 ${option.tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{option.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {isLocked ? 'Recorded by admin' : option.desc}
                        </span>
                      </div>
                    </div>
                    {isActive ? (
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {STATUS_LOCK_MESSAGE}
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <HelpCircle className="h-4 w-4 text-primary" />
                Policy reminders
              </div>
              <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs">
                <a href={POLICY_DOC_URL} target="_blank" rel="noreferrer">
                  View full policy
                </a>
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {POLICY_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
          {leaveRequiresNotice ? (
            <div className="space-y-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-3">
              {requiresLeaveType ? (
                <div className="space-y-1">
                  <Label htmlFor="attendance-leave-type" className="text-xs text-muted-foreground font-medium">
                    Leave type
                  </Label>
                  <select
                    id="attendance-leave-type"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    value={leaveCategory}
                    onChange={(event) => setLeaveCategory(event.target.value)}
                  >
                    <option value="">Select leave type</option>
                    {leaveCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={informedLeave}
                  onChange={(event) => setInformedLeave(event.target.checked)}
                  className="h-4 w-4 rounded border border-border text-primary focus:ring-primary/40"
                />
                I informed HR / Reporting Manager before the shift
              </label>
            </div>
          ) : null}
          {policyImpact ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Shift summary</span>
                {policyWarnings.length ? (
                  <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                    Policy alert
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Compliant
                  </Badge>
                )}
              </div>
              <div className="text-sm text-foreground">
                {policyImpact.checkInTime || '—'} → {policyImpact.checkOutTime || '—'}
                <span className="ml-2 text-xs text-muted-foreground">
                  {policyImpact.workingMinutes
                    ? `${formatDuration(policyImpact.workingMinutes)} logged`
                    : 'Add both times to compute hours'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Break used: {policyImpact.breakMinutes ?? 0}m (45m allowance)
              </p>
              {policyWarnings.length ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-rose-600">
                  {policyWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600">All attendance rules satisfied.</p>
              )}
            </div>
          ) : null}
          <Button className="w-full" onClick={handleAttendanceSubmit} disabled={submitAttendanceDisabled}>
            {submitAttendance.isPending ? 'Submitting.' : 'Submit attendance'}
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">{attendanceStatusDetail}</p>
        </Card>
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
      {leaveHistory.length ? (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent Leave Requests</h2>
              <p className="text-xs text-muted-foreground">Latest submissions and admin decisions</p>
            </div>
            <Badge variant="outline">{leaveHistory.length} shown</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Approval</th>
                  <th className="px-3 py-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {leaveHistory.map((record) => (
                  <tr key={record.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-medium text-foreground">{record.date}</td>
                    <td className="px-3 py-2 capitalize">{record.reportedStatus}</td>
                    <td className="px-3 py-2 capitalize">{record.approvalStatus}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {record.reviewerNote || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
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








