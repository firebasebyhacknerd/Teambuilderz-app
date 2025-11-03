import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { User, Users, FileText, Target, AlertTriangle, CircleUser, ChevronRight } from 'lucide-react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { useRecruiterProfileQuery } from '../../../lib/queryHooks';

const buildSidebarLinks = (role) => {
  if (role === 'Admin') {
    return [
      { href: '/admin', label: 'Dashboard', icon: Users },
      { href: '/admin/candidates', label: 'Candidates', icon: User },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ];
  }

  return [
    { href: '/recruiter', label: 'Dashboard', icon: Target },
    { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    { href: '/profile', label: 'My Profile', icon: CircleUser },
  ];
};

const stageLabels = {
  onboarding: 'Onboarding',
  marketing: 'Marketing',
  interviewing: 'Interviewing',
  offered: 'Offered',
  placed: 'Placed',
  inactive: 'Inactive',
};

const formatStage = (stage) => stageLabels[stage] ?? (stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'Unknown');
const formatStatus = (status) =>
  status ? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';

const MetricCard = ({ title, metrics }) => (
  <Card className="p-4 space-y-2">
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
      <div className="rounded-md border border-border bg-muted/40 px-2 py-1 text-center">
        <p className="font-semibold text-foreground">{metrics.total}</p>
        <p>Total</p>
      </div>
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-center text-emerald-700">
        <p className="font-semibold text-emerald-800">{metrics.approved}</p>
        <p>Approved</p>
      </div>
      <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-center text-amber-700">
        <p className="font-semibold text-amber-800">{metrics.pending}</p>
        <p>Pending</p>
      </div>
    </div>
  </Card>
);

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value ?? 'N/A'}</span>
  </div>
);

const RecruiterProfilePage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('Recruiter');
  const PAGE_SIZE = 6;
  const [limits, setLimits] = useState({
    assignedCandidates: PAGE_SIZE,
    recentApplications: PAGE_SIZE,
    upcomingInterviews: PAGE_SIZE,
    pendingAssessments: PAGE_SIZE,
    recentNotes: PAGE_SIZE,
    upcomingReminders: PAGE_SIZE,
    openAlerts: PAGE_SIZE,
  });

  const recruiterId = useMemo(() => {
    if (!id) return null;
    const parsed = Array.isArray(id) ? parseInt(id[0], 10) : parseInt(id, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [id]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) {
      setUserRole(storedRole);
    }
  }, [router]);

  const profileParams = useMemo(
    () => ({
      assignedCandidatesLimit: limits.assignedCandidates,
      assignedCandidatesOffset: 0,
      recentApplicationsLimit: limits.recentApplications,
      recentApplicationsOffset: 0,
      upcomingInterviewsLimit: limits.upcomingInterviews,
      upcomingInterviewsOffset: 0,
      pendingAssessmentsLimit: limits.pendingAssessments,
      pendingAssessmentsOffset: 0,
      recentNotesLimit: limits.recentNotes,
      recentNotesOffset: 0,
      upcomingRemindersLimit: limits.upcomingReminders,
      upcomingRemindersOffset: 0,
      openAlertsLimit: limits.openAlerts,
      openAlertsOffset: 0,
    }),
    [limits],
  );

  const {
    data: profileData,
    isLoading,
    isFetching,
    error,
  } = useRecruiterProfileQuery(token, recruiterId, profileParams, Boolean(token && recruiterId));

  const sidebarLinks = useMemo(() => buildSidebarLinks(userRole), [userRole]);

  const isBusy = isLoading || isFetching;
  const assignedCandidatesData = profileData?.assignedCandidates ?? { items: [], hasMore: false };
  const recentApplicationsData = profileData?.recentApplications ?? { items: [], hasMore: false };
  const upcomingInterviewsData = profileData?.upcomingInterviews ?? { items: [], hasMore: false };
  const pendingAssessmentsData = profileData?.pendingAssessments ?? { items: [], hasMore: false };
  const recentNotesData = profileData?.recentNotes ?? { items: [], hasMore: false };
  const upcomingRemindersData = profileData?.upcomingReminders ?? { items: [], hasMore: false };
  const openAlertsData = profileData?.openAlerts ?? { items: [], hasMore: false };

  const assignedCandidates = assignedCandidatesData.items;
  const recentApplications = recentApplicationsData.items;
  const upcomingInterviews = upcomingInterviewsData.items;
  const pendingAssessments = pendingAssessmentsData.items;
  const recentNotes = recentNotesData.items;
  const upcomingReminders = upcomingRemindersData.items;
  const openAlerts = openAlertsData.items;
  const recruiterSummary = profileData?.user;

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }), []);
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  );

  const metrics = profileData?.metrics ?? {
    applications: { total: 0, approved: 0, pending: 0 },
    interviews: { total: 0, approved: 0, pending: 0 },
    assessments: { total: 0, approved: 0, pending: 0 },
  };
  const assignedCandidatesHasMore = assignedCandidatesData.hasMore;
  const recentApplicationsHasMore = recentApplicationsData.hasMore;
  const upcomingInterviewsHasMore = upcomingInterviewsData.hasMore;
  const pendingAssessmentsHasMore = pendingAssessmentsData.hasMore;
  const recentNotesHasMore = recentNotesData.hasMore;
  const upcomingRemindersHasMore = upcomingRemindersData.hasMore;
  const openAlertsHasMore = openAlertsData.hasMore;

  const handleLoadMore = (section) => {
    setLimits((prev) => ({
      ...prev,
      [section]: prev[section] + PAGE_SIZE,
    }));
  };

  const formatDateSafe = (value) => (value ? dateFormatter.format(new Date(value)) : 'Not set');
  const formatDateTimeSafe = (value) => (value ? dateTimeFormatter.format(new Date(value)) : 'Not set');
  const truncate = (text, length = 120) =>
    text && text.length > length ? `${text.slice(0, length - 1)}\u2026` : text || 'No details provided';

  const quickActions = useMemo(() => {
    const actions = [
      {
        label: 'View Candidates',
        description: 'Review assigned pipeline',
        icon: Users,
        onClick: () => router.push('/recruiter/candidates'),
      },
      {
        label: 'Log Application',
        description: "Capture today's submissions",
        icon: FileText,
        onClick: () => router.push('/recruiter/applications'),
      },
      {
        label: 'View Alerts',
        description: 'Check reminders & escalations',
        icon: AlertTriangle,
        onClick: () => router.push('/alerts'),
      },
    ];

    if (userRole === 'Admin') {
      actions.push({
        label: 'Manage Team',
        description: 'Adjust quotas and access',
        icon: User,
        onClick: () => router.push('/admin/recruiters'),
      });
    }

    return actions;
  }, [router, userRole]);

  return (
    <DashboardLayout
      title={recruiterSummary?.name ? `${recruiterSummary.name}` : 'Recruiter Profile'}
      subtitle="Review activity and pipeline metrics for this recruiter."
      links={sidebarLinks}
      onBack={() => router.back()}
    >
      {isBusy ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Loading recruiter profile...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
          Unable to load recruiter details. Please try again.
        </div>
      ) : !profileData ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Recruiter profile not found.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Profile</h2>
                <p className="text-sm text-muted-foreground">Core information and access level.</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <InfoRow label="Name" value={recruiterSummary?.name} />
                <InfoRow label="Email" value={recruiterSummary?.email} />
                <InfoRow label="Role" value={recruiterSummary?.role} />
                <InfoRow label="Daily Quota" value={recruiterSummary?.daily_quota ?? 'Not set'} />
                <div className="flex items-center gap-2">
                  <InfoRow label="Status" value={recruiterSummary?.is_active ? 'Active' : 'Inactive'} />
                  <Badge variant={recruiterSummary?.is_active ? 'default' : 'outline'}>
                    {recruiterSummary?.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <InfoRow label="Joined" value={formatDateSafe(recruiterSummary?.created_at)} />
                <InfoRow label="Last Updated" value={formatDateSafe(recruiterSummary?.updated_at)} />
              </div>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card className="p-4 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
                  <p className="text-sm text-muted-foreground">Jump into common workflows for this recruiter.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickActions.map(({ label, description, onClick, icon: ActionIcon }) => (
                    <Button
                      key={label}
                      variant="outline"
                      className="h-auto justify-start gap-3 py-3"
                      onClick={onClick}
                    >
                      <ActionIcon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard title="Applications" metrics={metrics.applications} />
                <MetricCard title="Interviews" metrics={metrics.interviews} />
                <MetricCard title="Assessments" metrics={metrics.assessments} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Assigned Candidates</h3>
                  <p className="text-sm text-muted-foreground">
                    Candidates currently managed by {recruiterSummary?.name}.
                  </p>
                </div>
                {assignedCandidates.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => router.push('/recruiter/candidates')}>
                    View all
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
              {assignedCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned candidates yet.</p>
              ) : (
                <div className="space-y-3">
                  {assignedCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{candidate.name}</span>
                        <span className="text-xs text-muted-foreground">{candidate.email}</span>
                        <Badge variant="outline" className="w-fit text-xs capitalize">
                          {formatStage(candidate.currentStage)}
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>
                          <span className="font-semibold text-foreground">{candidate.todayApplications}</span> today
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">{candidate.totalApplications}</span> total
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {assignedCandidatesHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('assignedCandidates')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Recent Applications</h3>
                  <p className="text-sm text-muted-foreground">Latest submissions logged by this recruiter.</p>
                </div>
                {recentApplications.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => router.push('/recruiter/applications')}>
                    View all
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
              {recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentApplications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => router.push(`/recruiter/candidate/${application.candidateId}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{application.companyName}</span>
                        <span className="text-xs text-muted-foreground">
                          {application.jobTitle}
                          {' \u00B7 '}
                          {application.candidateName}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground min-w-[120px]">
                        <Badge variant="outline" className="capitalize">
                          {formatStatus(application.status)}
                        </Badge>
                        <Badge
                          variant={application.isApproved ? 'default' : 'outline'}
                          className={application.isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}
                        >
                          {application.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        <span>{formatDateSafe(application.applicationDate)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {recentApplicationsHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('recentApplications')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Upcoming Interviews</h3>
                  <p className="text-sm text-muted-foreground">Scheduled interviews for assigned candidates.</p>
                </div>
                {upcomingInterviews.length > 0 && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {upcomingInterviews.length} scheduled
                  </Badge>
                )}
              </div>
              {upcomingInterviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingInterviews.map((interview) => (
                    <button
                      key={interview.id}
                      type="button"
                      onClick={() => router.push(`/recruiter/candidate/${interview.candidateId}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {interview.companyName}
                          {' \u00B7 '}
                          {formatStatus(interview.interviewType)}
                        </span>
                        <span className="text-xs text-muted-foreground">{interview.candidateName}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground min-w-[140px]">
                        <span>{formatDateTimeSafe(interview.scheduledDate)}</span>
                        <Badge variant="outline" className="capitalize">
                          {formatStatus(interview.status)}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {upcomingInterviewsHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('upcomingInterviews')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pending Assessments</h3>
                  <p className="text-sm text-muted-foreground">Assessments awaiting completion or review.</p>
                </div>
                {pendingAssessments.length > 0 && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {pendingAssessments.length} open
                  </Badge>
                )}
              </div>
              {pendingAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessments pending.</p>
              ) : (
                <div className="space-y-3">
                  {pendingAssessments.map((assessment) => (
                    <button
                      key={assessment.id}
                      type="button"
                      onClick={() => router.push(`/recruiter/candidate/${assessment.candidateId}`)}
                      className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">
                          {assessment.assessmentPlatform}
                          {' \u00B7 '}
                          {formatStatus(assessment.assessmentType)}
                        </span>
                        <span className="text-xs text-muted-foreground">{assessment.candidateName}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground min-w-[140px]">
                        <span>Due {formatDateSafe(assessment.dueDate)}</span>
                        <Badge variant="outline" className="capitalize">
                          {formatStatus(assessment.status)}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {pendingAssessmentsHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('pendingAssessments')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Recent Notes</h3>
                <p className="text-sm text-muted-foreground">Latest collaboration updates authored by this recruiter.</p>
              </div>
              {recentNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes captured yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => note.candidateId && router.push(`/recruiter/candidate/${note.candidateId}`)}
                      className="w-full rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <p className="text-sm font-medium text-foreground">{truncate(note.content, 140)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {note.candidateName ? `${note.candidateName} \u00B7 ` : ''}
                        {formatDateTimeSafe(note.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {recentNotesHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('recentNotes')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Upcoming Reminders</h3>
                <p className="text-sm text-muted-foreground">Deadlines and follow-ups assigned to this recruiter.</p>
              </div>
              {upcomingReminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminders scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingReminders.map((reminder) => (
                    <button
                      key={reminder.id}
                      type="button"
                      onClick={() => router.push('/alerts')}
                      className="w-full rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{reminder.title}</span>
                        <Badge variant="outline" className="capitalize">
                          {formatStatus(reminder.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Due {formatDateSafe(reminder.dueDate)}
                        {reminder.candidateName ? ` \u00B7 ${reminder.candidateName}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">Priority {reminder.priority}</p>
                    </button>
                  ))}
                </div>
              )}
              {upcomingRemindersHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('upcomingReminders')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Open Alerts</h3>
                <p className="text-sm text-muted-foreground">System-generated alerts requiring attention.</p>
              </div>
              {openAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts raised for this recruiter.</p>
              ) : (
                <div className="space-y-3">
                  {openAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => router.push('/alerts')}
                      className="w-full rounded-md border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                        <Badge variant="outline" className="capitalize">
                          {formatStatus(alert.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{truncate(alert.message, 140)}</p>
                      <p className="text-xs text-muted-foreground">
                        Priority {alert.priority}
                        {' \u00B7 '}
                        {formatDateTimeSafe(alert.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {openAlertsHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleLoadMore('openAlerts')}
                  disabled={isFetching}
                >
                  Load more
                </Button>
              )}
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RecruiterProfilePage;

