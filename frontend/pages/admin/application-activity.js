import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  BarChart3,
  CircleUser,
  FileText,
  Home,
  LogOut,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  useApplicationActivityReportQuery,
  useCandidatesQuery,
  useUsersQuery,
} from '../../lib/queryHooks';

const numberFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const rangeOptions = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
];

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

const ApplicationActivityPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [range, setRange] = useState('30d');
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');

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

  const rangeConfig = useMemo(() => {
    const option = rangeOptions.find((item) => item.value === range) ?? rangeOptions[1];
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (option.days - 1));
    const toStr = (date) => date.toISOString().split('T')[0];
    return {
      ...option,
      startDate,
      endDate,
      startDateStr: toStr(startDate),
      endDateStr: toStr(endDate),
    };
  }, [range]);

  const filterParams = useMemo(
    () => ({
      date_from: rangeConfig.startDateStr,
      date_to: rangeConfig.endDateStr,
      recruiter_id: selectedRecruiter || undefined,
      candidate_id: selectedCandidate || undefined,
    }),
    [rangeConfig.startDateStr, rangeConfig.endDateStr, selectedRecruiter, selectedCandidate],
  );

  const {
    data: report,
    isLoading: reportLoading,
    isFetching: reportRefreshing,
    refetch: refetchReport,
  } = useApplicationActivityReportQuery(token, Boolean(token), filterParams);

  const { data: users = [] } = useUsersQuery(token, Boolean(token));
  const { data: candidates = [] } = useCandidatesQuery(token, Boolean(token));

  const recruiterOptions = useMemo(
    () =>
      users
        .filter((user) => user.role === 'Recruiter')
        .map((user) => ({
          id: user.id,
          name: user.name,
          isActive: user.is_active !== false,
        })),
    [users],
  );

  const candidateOptions = useMemo(
    () =>
      candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
      })),
    [candidates],
  );

  const sidebarLinks = useMemo(
    () => [
      { href: '/admin', label: 'Dashboard', icon: Home },
      { href: '/admin/candidates', label: 'Candidates', icon: Users },
      { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
      { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
      { href: '/admin/application-activity', label: 'Application Activity', icon: BarChart3 },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/profile', label: 'My Profile', icon: CircleUser },
    ],
    [],
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.replace('/login');
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSelectedRecruiter('');
    setSelectedCandidate('');
  }, []);

  const totals = report?.totals ?? {
    overall: 0,
    byRecruiter: [],
    byCandidate: [],
    byDate: [],
  };

  const topRecruiter = totals.byRecruiter?.[0] ?? null;
  const topCandidate = totals.byCandidate?.[0] ?? null;
  const peakDay =
    (totals.byDate || []).reduce(
      (best, entry) => (entry.totalApplications > (best?.totalApplications ?? 0) ? entry : best),
      null,
    ) ?? null;

  const details = report?.records ?? [];
  const generatedLabel = report?.generatedAt
    ? dateTimeFormatter.format(new Date(report.generatedAt))
    : '—';

  const isLoading = reportLoading && !reportRefreshing;

  if (!token) {
    return null;
  }

  return (
    <DashboardLayout
      title="Application Activity"
      subtitle={`Detailed recruiter & candidate submissions — Hello, ${userName}`}
      links={sidebarLinks}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchReport()}
            disabled={reportLoading}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Reporting Window</p>
          <p className="text-sm text-muted-foreground">
            {dateFormatter.format(rangeConfig.startDate)} – {dateFormatter.format(rangeConfig.endDate)}
          </p>
          <p className="text-xs text-muted-foreground">Last updated {generatedLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className={selectClass}
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={selectedRecruiter}
            onChange={(event) => setSelectedRecruiter(event.target.value)}
            className={selectClass}
          >
            <option value="">All recruiters</option>
            {recruiterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          <select
            value={selectedCandidate}
            onChange={(event) => setSelectedCandidate(event.target.value)}
            className={selectClass}
          >
            <option value="">All candidates</option>
            {candidateOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 flex items-center justify-center text-muted-foreground">
          Loading application activity…
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total applications</p>
              <p className="text-2xl font-semibold text-foreground">
                {numberFormatter.format(totals.overall ?? 0)}
              </p>
              {reportRefreshing && <p className="text-xs text-muted-foreground mt-1">Refreshing…</p>}
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Top recruiter</p>
              <p className="text-lg font-medium text-foreground">
                {topRecruiter ? topRecruiter.recruiterName : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {topRecruiter ? `${numberFormatter.format(topRecruiter.totalApplications)} applications` : 'No data'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Top candidate</p>
              <p className="text-lg font-medium text-foreground">
                {topCandidate ? topCandidate.candidateName : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {topCandidate ? `${numberFormatter.format(topCandidate.totalApplications)} applications` : 'No data'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Busiest day</p>
              <p className="text-lg font-medium text-foreground">
                {peakDay ? dateFormatter.format(new Date(peakDay.date)) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {peakDay ? `${numberFormatter.format(peakDay.totalApplications)} applications` : 'No data'}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Applications by recruiter</h3>
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(totals.byRecruiter?.length ?? 0)} recruiters
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Recruiter</th>
                      <th className="py-2 font-medium text-right">Applications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.byRecruiter?.length ? (
                      totals.byRecruiter.map((entry) => (
                        <tr key={entry.recruiterId} className="border-t border-border/80">
                          <td className="py-2 pr-4">{entry.recruiterName}</td>
                          <td className="py-2 text-right">
                            {numberFormatter.format(entry.totalApplications)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-muted-foreground">
                          No recruiter activity in this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Applications by candidate</h3>
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(totals.byCandidate?.length ?? 0)} candidates
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Candidate</th>
                      <th className="py-2 font-medium text-right">Applications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.byCandidate?.length ? (
                      totals.byCandidate.map((entry) => (
                        <tr key={entry.candidateId} className="border-t border-border/80">
                          <td className="py-2 pr-4">{entry.candidateName}</td>
                          <td className="py-2 text-right">
                            {numberFormatter.format(entry.totalApplications)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="py-4 text-center text-muted-foreground">
                          No candidate activity in this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Detailed activity</h3>
              <span className="text-xs text-muted-foreground">
                {numberFormatter.format(details.length)} records
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Recruiter</th>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 font-medium text-right">Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {details.length ? (
                    details.map((entry, index) => (
                      <tr
                        key={`${entry.activityDate}-${entry.recruiter.id}-${entry.candidate.id}-${index}`}
                        className="border-t border-border/70"
                      >
                        <td className="py-2 pr-4">
                          {dateFormatter.format(new Date(entry.activityDate))}
                        </td>
                        <td className="py-2 pr-4">{entry.recruiter.name}</td>
                        <td className="py-2 pr-4">{entry.candidate.name}</td>
                        <td className="py-2 text-right">
                          {numberFormatter.format(entry.applicationsCount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">
                        No activity found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ApplicationActivityPage;

