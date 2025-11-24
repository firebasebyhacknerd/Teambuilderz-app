import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle2, XCircle, Clock, CalendarCheck, Loader2, Sunrise } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  useAttendanceQuery,
  useSubmitAttendanceMutation,
  useUpdateAttendanceMutation,
  useUsersQuery,
} from '../../lib/queryHooks';
import { emitRefresh, REFRESH_CHANNELS } from '../../lib/refreshBus';
import { getAdminSidebarLinks } from '../../lib/adminSidebarLinks';

const formatDateIso = (date) => {
  const source = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(source.getTime())) {
    return '';
  }
  return source.toISOString().split('T')[0];
};

const presetRange = (preset) => {
  const today = new Date();
  const todayIso = formatDateIso(today);
  if (preset === 'today') {
    return { from: todayIso, to: todayIso };
  }
  if (preset === 'week') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
    return { from: formatDateIso(start), to: todayIso };
  }
  // default month
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { from: formatDateIso(start), to: todayIso };
};

const statusTone = {
  present: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  'half-day': 'bg-amber-50 text-amber-800 border border-amber-200',
  absent: 'bg-red-100 text-red-800 border border-red-200',
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  rejected: 'bg-rose-100 text-rose-800 border border-rose-200',
  auto: 'bg-slate-100 text-slate-700 border border-slate-200',
  sandwich: 'bg-purple-100 text-purple-800 border border-purple-200',
};

const leaveCategoryLabels = {
  cl: 'Casual Leave (CL)',
  sl: 'Sick Leave (SL)',
  emergency: 'Emergency Leave',
  lwp: 'Loss of Pay (LWP)',
};

const halfDayReasonLabels = {
  'late-login': 'Late login past 8 PM',
  'early-logout': 'Early logout (>2h early)',
  'reported-half-day': 'Manual half-day',
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

const effectiveStatusFromRecord = (record) => {
  if (!record) {
    return 'pending';
  }
  if (record.approvalStatus === 'approved') {
    if (record.reportedStatus === 'present') {
      return 'present';
    }
    if (record.reportedStatus === 'half-day') {
      return 'half-day';
    }
    return 'absent';
  }
  if (record.approvalStatus === 'rejected') {
    return 'rejected';
  }
  return 'pending';
};

const AdminAttendancePage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const todayIso = useMemo(() => formatDateIso(new Date()), []);
  const startOfMonthIso = useMemo(() => {
    const { from } = presetRange('month');
    return from;
  }, []);

  const [dateFrom, setDateFrom] = useState(startOfMonthIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [activePreset, setActivePreset] = useState('month');
  const [selectedRecruiter, setSelectedRecruiter] = useState('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const sidebarLinks = useMemo(() => getAdminSidebarLinks(), []);

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
  }, [router]);

  const attendanceParams = useMemo(() => {
    const params = {
      date_from: dateFrom,
      date_to: dateTo,
    };
    if (selectedRecruiter && selectedRecruiter !== 'all') {
      params.user_id = selectedRecruiter;
    }
    if (pendingOnly) {
      params.pending_only = true;
    }
    return params;
  }, [dateFrom, dateTo, selectedRecruiter, pendingOnly]);

  const { data: users = [] } = useUsersQuery(token, Boolean(token));
  const recruiterOptions = useMemo(
    () => (users || []).filter((user) => user.role === 'Recruiter'),
    [users],
  );

  const {
    data: attendanceData,
    isFetching: attendanceLoading,
  } = useAttendanceQuery(token, attendanceParams, Boolean(token));

  const submitAttendance = useSubmitAttendanceMutation(token, {
    onSuccess: () => {
      setActionMessage({ type: 'success', text: 'Attendance entry saved.' });
      setNewEntry({
        userId: '',
        date: todayIso,
        status: 'absent',
        note: '',
      });
      emitRefresh(REFRESH_CHANNELS.ATTENDANCE);
      emitRefresh(REFRESH_CHANNELS.DASHBOARD);
    },
    onError: (error) => {
      setActionMessage({ type: 'error', text: error.message || 'Unable to save attendance entry.' });
    },
  });

  const updateAttendance = useUpdateAttendanceMutation(token, {
    onSuccess: () => {
      setActionMessage({ type: 'success', text: 'Attendance updated.' });
      emitRefresh(REFRESH_CHANNELS.ATTENDANCE);
      emitRefresh(REFRESH_CHANNELS.DASHBOARD);
    },
    onError: (error) => {
      setActionMessage({ type: 'error', text: error.message || 'Unable to update attendance.' });
    },
  });

  const [newEntry, setNewEntry] = useState({
    userId: '',
    date: todayIso,
    status: 'absent',
    note: '',
    checkInTime: '',
    checkOutTime: '',
    breakMinutes: '45',
    leaveCategory: '',
    informed: false,
  });

  const handleCreateEntry = (event) => {
    event.preventDefault();
    if (!newEntry.userId) {
      setActionMessage({ type: 'error', text: 'Select a recruiter before creating an entry.' });
      return;
    }
    const requiresTimes = newEntry.status === 'present' || newEntry.status === 'half-day';
    const payload = {
      user_id: Number(newEntry.userId),
      attendance_date: newEntry.date,
      status: newEntry.status,
      approval_status: 'approved',
      reviewer_note: newEntry.note || null,
    };
    if (requiresTimes) {
      payload.check_in_time = newEntry.checkInTime || null;
      payload.check_out_time = newEntry.checkOutTime || null;
      payload.break_minutes = Math.max(0, parseInt(newEntry.breakMinutes || '0', 10));
    }
    if (newEntry.status === 'leave') {
      payload.leave_category = newEntry.leaveCategory || null;
    }
    if (newEntry.status === 'leave' || newEntry.status === 'absent') {
      payload.informed_leave = newEntry.informed;
    }
    submitAttendance.mutate(payload);
  };

  const handleUpdate = (recordId, payload) => {
    setPendingUpdateId(recordId);
    updateAttendance.mutate(
      { attendanceId: recordId, payload },
      {
        onSettled: () => setPendingUpdateId(null),
      },
    );
  };

  const summary = attendanceData?.summary ?? {
    present: 0,
    halfDay: 0,
    absent: 0,
    pending: 0,
    autoPresent: 0,
    sandwichAbsent: 0,
  };
  const policySummary = summary.policy ?? {
    halfDays: 0,
    uninformedLeaves: 0,
    leaveDeductionsFromHalfDays: 0,
    remainingHalfDays: 0,
    totalDeductionDays: 0,
  };

  const records = useMemo(() => attendanceData?.records ?? [], [attendanceData]);

  const selectedDayView = useMemo(() => {
    if (!selectedRecruiter || selectedRecruiter === 'all') {
      return [];
    }
    const dayList = attendanceData?.days ?? [];
    return dayList.filter((day) => String(day.userId) === String(selectedRecruiter));
  }, [attendanceData, selectedRecruiter]);

  const isSubmitting = submitAttendance.isPending;
  const isUpdating = updateAttendance.isPending;

  return (
    <DashboardLayout
      title="Attendance Control"
      subtitle="Review recruiter attendance submissions and approvals."
      links={sidebarLinks}
      actions={null}
      onBack={null}
    >
      <div className="space-y-6">
        <Card className="p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Filters</h2>
              <p className="text-xs text-muted-foreground">
                Use the filters to inspect a specific recruiter or timeframe.
              </p>
            </div>
            <Badge variant="outline" className="gap-2 text-xs animate-[pulse_3s_ease-in-out_infinite]">
              <CalendarCheck size={14} />
              Range {attendanceData?.range?.dateFrom ?? dateFrom} → {attendanceData?.range?.dateTo ?? dateTo}
            </Badge>
          </div>
          <div className="px-6 py-5 space-y-5">
            {actionMessage ? (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  actionMessage.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {actionMessage.text}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'Last 7 days' },
                { key: 'month', label: 'This month' },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  variant={activePreset === preset.key ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full transition-transform duration-150 hover:-translate-y-0.5"
                  onClick={() => {
                    const range = presetRange(preset.key);
                    setDateFrom(range.from);
                    setDateTo(range.to);
                    setActivePreset(preset.key);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attendance-from">From</Label>
                <Input
                  id="attendance-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-to">To</Label>
                <Input
                  id="attendance-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-recruiter">Recruiter</Label>
                <select
                  id="attendance-recruiter"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  value={selectedRecruiter}
                  onChange={(event) => setSelectedRecruiter(event.target.value)}
                >
                  <option value="all">All recruiters</option>
                  {recruiterOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pending-only">Pending filter</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <input
                    id="pending-only"
                    type="checkbox"
                    checked={pendingOnly}
                    onChange={(event) => setPendingOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">Pending approvals only</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Summary</h2>
          <p className="text-xs text-muted-foreground">
            Approved attendance counts reflect only admin-approved or auto weekend days.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <SummaryStat
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Approved Presents"
              value={summary.present}
              accent="bg-emerald-50 text-emerald-900"
            />
            <SummaryStat
              icon={<Sunrise className="h-4 w-4 text-amber-600" />}
              label="Approved Half Days"
              value={summary.halfDay}
              accent="bg-amber-50 text-amber-900"
            />
            <SummaryStat
              icon={<XCircle className="h-4 w-4 text-red-600" />}
              label="Approved Absents"
              value={summary.absent}
              accent="bg-red-50 text-red-900"
              meta={summary.sandwichAbsent > 0 ? `${summary.sandwichAbsent} sandwich` : null}
            />
            <SummaryStat
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              label="Pending Decisions"
              value={summary.pending}
              accent="bg-amber-50 text-amber-900"
            />
            <SummaryStat
              icon={<CalendarCheck className="h-4 w-4 text-slate-600" />}
              label="Auto Weekend Presents"
              value={summary.autoPresent}
              accent="bg-slate-100 text-slate-700"
            />
            <SummaryStat
              icon={<Clock className="h-4 w-4 text-indigo-600" />}
              label="Half-Day Infractions"
              value={policySummary.halfDays}
              accent="bg-indigo-50 text-indigo-900"
              meta={
                policySummary.leaveDeductionsFromHalfDays > 0
                  ? `${policySummary.leaveDeductionsFromHalfDays} full-day deduction`
                  : null
              }
            />
            <SummaryStat
              icon={<XCircle className="h-4 w-4 text-rose-600" />}
              label="Uninformed Leaves"
              value={policySummary.uninformedLeaves}
              accent="bg-rose-50 text-rose-900"
              meta={
                policySummary.totalDeductionDays > 0
                  ? `${policySummary.totalDeductionDays} total deduction days`
                  : null
              }
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Attendance Entries</h2>
              <p className="text-xs text-muted-foreground">
                Approve or adjust recruiter submissions. Approved absents will trigger sandwich leave automatically.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {attendanceLoading ? 'Loading entriesâ€¦' : `${records.length} entries`}
            </Badge>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border border-border rounded-lg overflow-hidden text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Recruiter</th>
                  <th className="px-4 py-2 text-left">Submitted</th>
                  <th className="px-4 py-2 text-left">Approval</th>
                  <th className="px-4 py-2 text-left">Effective</th>
                  <th className="px-4 py-2 text-left">Shift &amp; Leave</th>
                  <th className="px-4 py-2 text-left">Policy Flags</th>
                  <th className="px-4 py-2 text-left">Note</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                      No attendance submissions for the selected filters.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const effective = effectiveStatusFromRecord(record);
                    const isRowBusy = isUpdating && pendingUpdateId === record.id;
                    const policyImpact = record.policyImpact ?? null;
                    const shiftLabel =
                      record.checkInTime && record.checkOutTime
                        ? `${record.checkInTime} → ${record.checkOutTime}`
                        : 'No timings';
                    const leaveLabel = record.leaveCategory
                      ? leaveCategoryLabels[record.leaveCategory] || record.leaveCategory.toUpperCase()
                      : null;
                    const policyReasons =
                      policyImpact?.halfDayReasons?.length
                        ? policyImpact.halfDayReasons.map((reason) => halfDayReasonLabels[reason] || reason)
                        : [];
                    const policyHasFlags =
                      (policyImpact?.lateLoginMinutes ?? 0) > 0 ||
                      (policyImpact?.earlyLogoutMinutes ?? 0) > 0 ||
                      (policyImpact?.breakOverMinutes ?? 0) > 0 ||
                      policyImpact?.halfDay ||
                      policyImpact?.uninformedLeave;
                    return (
                      <tr key={record.id} className="border-t border-border/70">
                        <td className="px-4 py-3 font-medium text-foreground">{record.date}</td>
                        <td className="px-4 py-3">{record.userName}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`capitalize ${statusTone[record.reportedStatus] ?? ''}`}>
                            {record.reportedStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`capitalize ${
                              statusTone[record.approvalStatus] ?? 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {record.approvalStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`capitalize ${statusTone[effective] ?? 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                          >
                            {effective}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <div className="text-sm text-foreground">{shiftLabel}</div>
                            <div>
                              Break: {record.breakMinutes ?? 0}m
                              {policyImpact?.workingMinutes
                                ? ` • ${formatDuration(policyImpact.workingMinutes)} logged`
                                : null}
                            </div>
                            <div>
                              {leaveLabel ? `${leaveLabel} • ` : ''}
                              {record.informedLeave ? 'Informed' : 'Uninformed'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {policyImpact ? (
                            policyHasFlags ? (
                              <div className="flex flex-wrap gap-1 text-xs">
                                {policyImpact.lateLoginMinutes ? (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                    Late +{formatDuration(policyImpact.lateLoginMinutes)}
                                  </Badge>
                                ) : null}
                                {policyImpact.earlyLogoutMinutes ? (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                    Early -{formatDuration(policyImpact.earlyLogoutMinutes)}
                                  </Badge>
                                ) : null}
                                {policyImpact.breakOverMinutes ? (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                    Break +{formatDuration(policyImpact.breakOverMinutes)}
                                  </Badge>
                                ) : null}
                                {policyImpact.halfDay ? (
                                  <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">
                                    Half-day
                                  </Badge>
                                ) : null}
                                {policyReasons.length > 0 ? (
                                  <span className="text-[11px] text-muted-foreground">{policyReasons.join(', ')}</span>
                                ) : null}
                                {policyImpact.uninformedLeave ? (
                                  <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800">
                                    Uninformed leave
                                  </Badge>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No policy flags</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">No policy data</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {record.reviewerNote ? (
                            <span className="text-xs text-muted-foreground">{record.reviewerNote}</span>
                          ) : (
                            <span className="text-xs text-slate-400">â€”</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              className="gap-1"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdate(record.id, {
                                  status: 'present',
                                  approval_status: 'approved',
                                })
                              }
                              aria-live="polite"
                              aria-busy={isRowBusy}
                            >
                              {isRowBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                              Mark Present
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="gap-1"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdate(record.id, {
                                  status: 'half-day',
                                  approval_status: 'approved',
                                })
                              }
                              aria-live="polite"
                              aria-busy={isRowBusy}
                            >
                              {isRowBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                              Mark Half Day
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="gap-1"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdate(record.id, {
                                  status: 'absent',
                                  approval_status: 'approved',
                                })
                              }
                              aria-live="polite"
                              aria-busy={isRowBusy}
                            >
                              {isRowBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                              Mark Absent
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="gap-1"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdate(record.id, {
                                  approval_status: 'pending',
                                })
                              }
                              aria-live="polite"
                              aria-busy={isRowBusy}
                            >
                              {isRowBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                              Reset Pending
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Create Attendance Entry</h2>
              <p className="text-xs text-muted-foreground">
                Use this form to record absences (including weekend sandwich scenarios) or override submissions.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateEntry} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-entry-recruiter">Recruiter</Label>
              <select
                id="new-entry-recruiter"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                value={newEntry.userId}
                onChange={(event) => setNewEntry((prev) => ({ ...prev, userId: event.target.value }))}
              >
                <option value="">Select recruiter</option>
                {recruiterOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-entry-date">Date</Label>
              <Input
                id="new-entry-date"
                type="date"
                value={newEntry.date}
                onChange={(event) => setNewEntry((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-entry-status">Status</Label>
              <select
                id="new-entry-status"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                value={newEntry.status}
                onChange={(event) => setNewEntry((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="present">Present</option>
                <option value="half-day">Half Day</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-entry-note">Reviewer Note</Label>
              <Input
                id="new-entry-note"
                placeholder="Optional note"
                value={newEntry.note}
                onChange={(event) => setNewEntry((prev) => ({ ...prev, note: event.target.value }))}
              />
            </div>
            {(newEntry.status === 'present' || newEntry.status === 'half-day') ? (
              <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-entry-checkin">Check-in (IST)</Label>
                  <Input
                    id="new-entry-checkin"
                    type="time"
                    value={newEntry.checkInTime}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, checkInTime: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-entry-checkout">Check-out (IST)</Label>
                  <Input
                    id="new-entry-checkout"
                    type="time"
                    value={newEntry.checkOutTime}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, checkOutTime: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-entry-break">Break minutes (max 45)</Label>
                  <Input
                    id="new-entry-break"
                    type="number"
                    min={0}
                    max={240}
                    value={newEntry.breakMinutes}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, breakMinutes: event.target.value }))}
                  />
                </div>
              </div>
            ) : null}
            {(newEntry.status === 'leave' || newEntry.status === 'absent') ? (
              <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {newEntry.status === 'leave' ? (
                  <div className="space-y-2">
                    <Label htmlFor="new-entry-leave-type">Leave type</Label>
                    <select
                      id="new-entry-leave-type"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      value={newEntry.leaveCategory}
                      onChange={(event) => setNewEntry((prev) => ({ ...prev, leaveCategory: event.target.value }))}
                    >
                      <option value="">Select leave type</option>
                      <option value="cl">Casual Leave (CL)</option>
                      <option value="sl">Sick Leave (SL)</option>
                      <option value="emergency">Emergency Leave</option>
                      <option value="lwp">Loss of Pay (LWP)</option>
                    </select>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newEntry.informed}
                    onChange={(event) => setNewEntry((prev) => ({ ...prev, informed: event.target.checked }))}
                    className="h-4 w-4 rounded border border-border text-primary focus:ring-primary/40"
                  />
                  Informed HR / reporting manager before shift
                </label>
              </div>
            ) : null}
            <div className="md:col-span-4 flex items-center justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
                aria-live="polite"
                aria-busy={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving entry...' : 'Save Attendance'}
              </Button>
            </div>
          </form>
        </Card>

        {selectedDayView.length > 0 ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground">Daily View</h2>
            <p className="text-xs text-muted-foreground">
              Auto weekend days show as present unless converted by sandwich leave.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border border-border rounded-lg overflow-hidden text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Weekday</th>
                    <th className="px-4 py-2 text-left">Effective</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Approval</th>
                    <th className="px-4 py-2 text-left">Shift</th>
                    <th className="px-4 py-2 text-left">Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayView.map((day) => (
                    <tr key={`${day.date}-${day.userId}`} className="border-t border-border/70">
                      <td className="px-4 py-2 font-medium text-foreground">{day.date}</td>
                      <td className="px-4 py-2 text-muted-foreground">{day.weekday}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            statusTone[day.effectiveStatus] ?? 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {day.effectiveStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {day.sandwichApplied ? 'sandwich-adjusted' : day.source}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {day.approvalStatus || 'â€”'}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {day.checkInTime && day.checkOutTime ? `${day.checkInTime} → ${day.checkOutTime}` : 'â€”'}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {day.policyImpact
                          ? [
                              day.policyImpact.halfDay ? 'Half-day' : null,
                              day.policyImpact.uninformedLeave ? 'UL' : null,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'None'
                          : 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

const SummaryStat = ({ icon, label, value, accent, meta = null }) => (
  <div className={`rounded-lg px-4 py-3 flex flex-col gap-1 ${accent}`}>
    <div className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      <span>{label}</span>
    </div>
    <span className="text-2xl font-bold">{value}</span>
    {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
  </div>
);

export default AdminAttendancePage;










