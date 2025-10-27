import React, { useEffect, useMemo, useState } from 'react';
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

const numberFormatter = new Intl.NumberFormat();
const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', minimumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const AdminDashboard = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');

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

  const { data: overview, isLoading: overviewLoading } = useAdminOverviewQuery(token, Boolean(token));
  const { data: activity, isLoading: activityLoading } = useAdminActivityQuery(token, Boolean(token));
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
  };
  const candidateStages = overview?.candidateStages ?? [];
  const marketingVelocity = overview?.marketingVelocity ?? {
    avgApplicationsPerCandidate: 0,
    avgDaysSinceLastApplication: 0,
  };
  const recruiterProductivity = overview?.recruiterProductivity ?? [];

  const recentNotes = activity?.recentNotes ?? [];
  const upcomingReminders = activity?.upcomingReminders ?? [];
  const recruiterNotes = activity?.recruiterNotes ?? [];
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const sidebarLinks = [
    { href: '/admin', label: 'Dashboard', icon: Home },
    { href: '/admin/candidates', label: 'Candidates', icon: Users },
    { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
    { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={<Users className="h-5 w-5 text-primary" />} title="Total Candidates" value={summary.totalCandidates} accent="bg-primary/10 text-primary" />
        <KpiCard icon={<Briefcase className="h-5 w-5 text-emerald-600" />} title="Active Recruiters" value={summary.totalRecruiters} accent="bg-emerald-100 text-emerald-700" />
        <KpiCard icon={<BarChart3 className="h-5 w-5 text-blue-600" />} title="Applications Today" value={summary.totalApplicationsToday} accent="bg-blue-100 text-blue-700" />
        <KpiCard icon={<Target className="h-5 w-5 text-pink-600" />} title="Interviews Today" value={summary.totalInterviewsToday} accent="bg-pink-100 text-pink-700" />
      </div>

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
              <RecruiterListItem key={recruiter.id} recruiter={recruiter} />
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

const KpiCard = ({ icon, title, value, accent }) => (
  <Card className="flex items-center gap-3 p-5">
    <div className={`h-11 w-11 rounded-full flex items-center justify-center ${accent}`}>{icon}</div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{numberFormatter.format(value)}</p>
    </div>
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

const RecruiterListItem = ({ recruiter }) => {
  const quota = Number(recruiter.dailyQuota || recruiter.daily_quota || 0);
  const avgPerDay7 = recruiter.avgApplicationsLast7Days ?? recruiter.avg_apps_last_7 ?? 0;
  const avgPerDay30 = recruiter.avgApplicationsLast30Days ?? recruiter.avg_apps_last_30 ?? 0;
  const applicationsToday = recruiter.applicationsToday ?? recruiter.applications_today ?? 0;
  const shortfall = quota > 0 ? applicationsToday - quota : applicationsToday;

  return (
    <div className="flex justify-between items-center px-6 py-3 hover:bg-muted/50 transition cursor-pointer">
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{recruiter.name}</span>
        <span className="text-xs text-muted-foreground">Quota: {quota}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-medium ${quota && applicationsToday < quota ? 'text-red-600' : 'text-emerald-600'}`}>
          {applicationsToday} / {quota || 'â€”'} Apps today
        </span>
        <span className="text-xs text-muted-foreground">
          7-day avg {avgPerDay7.toFixed(1)} â€¢ 30-day avg {avgPerDay30.toFixed(1)}
        </span>
        {quota > 0 && (
          <span className={`text-xs font-medium ${shortfall < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
            {shortfall < 0 ? `${Math.abs(shortfall)} below target` : 'On track'}
          </span>
        )}
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
          {note.candidateName} â€¢ {dateTimeFormatter.format(new Date(note.createdAt))}
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
        {reminder.candidate?.name ? ` â€¢ ${reminder.candidate.name}` : ''}
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
      {reminder.candidate?.name ? ` â€¢ ${reminder.candidate.name}` : ''}
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
      Owner: {alert.owner?.name ?? 'Unassigned'} â€¢ Priority {alert.priority}
    </p>
  </div>
);

export default AdminDashboard;



