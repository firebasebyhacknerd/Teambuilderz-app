import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { BarChart3, LogOut, Users, UserCheck, ClipboardList } from 'lucide-react';
import RecruiterBarChart from '../../components/analytics/RecruiterBarChart';
import CandidateBarChart from '../../components/analytics/CandidateBarChart';
import ApplicationTrendChart from '../../components/analytics/ApplicationTrendChart';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { getAdminSidebarLinks } from '../../lib/adminSidebarLinks';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import EmptyState from '../../components/ui/empty-state';
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
  { value: 'custom', label: 'Custom range' },
];

const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

const ApplicationActivityPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Admin');
  const [range, setRange] = useState('30d');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [selectedRecruiter, setSelectedRecruiter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [minApplications, setMinApplications] = useState('');

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
    const toStr = (date) => date.toISOString().split('T')[0];

    if (range === 'custom' && customRange.start && customRange.end) {
      const startDate = new Date(customRange.start);
      const endDate = new Date(customRange.end);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const normalizedStart = startDate <= endDate ? startDate : endDate;
        const normalizedEnd = startDate <= endDate ? endDate : startDate;
        return {
          value: 'custom',
          label: 'Custom range',
          startDate: normalizedStart,
          endDate: normalizedEnd,
          startDateStr: toStr(normalizedStart),
          endDateStr: toStr(normalizedEnd),
        };
      }
    }

    const option =
      rangeOptions.find((item) => item.value === range && item.days) ?? rangeOptions[1];
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - ((option.days ?? 30) - 1));

    return {
      ...option,
      startDate,
      endDate,
      startDateStr: toStr(startDate),
      endDateStr: toStr(endDate),
    };
  }, [customRange.end, customRange.start, range]);

  const filterParams = useMemo(
    () => ({
      date_from: rangeConfig.startDateStr,
      date_to: rangeConfig.endDateStr,
      recruiter_id: selectedRecruiter || undefined,
      candidate_id: selectedCandidate || undefined,
    }),
    [rangeConfig.startDateStr, rangeConfig.endDateStr, selectedRecruiter, selectedCandidate],
  );
  const hasCustomRange = range === 'custom' && customRange.start && customRange.end;

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

  const sidebarLinks = useMemo(() => getAdminSidebarLinks(), []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.replace('/login');
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setRange('30d');
    setCustomRange({ start: '', end: '' });
    setSelectedRecruiter('');
    setSelectedCandidate('');
    setSearchTerm('');
    setMinApplications('');
  }, []);

  const handleCustomShortcut = useCallback((shortcut) => {
    const today = new Date();
    const endISO = today.toISOString().split('T')[0];
    const start = new Date(today);

    if (shortcut === 'week') {
      start.setDate(start.getDate() - 6);
    } else if (shortcut === 'month') {
      start.setDate(1);
    } else if (shortcut === 'quarter') {
      const month = start.getMonth();
      const quarterStartMonth = month - (month % 3);
      start.setMonth(quarterStartMonth, 1);
    }

    const startISO = start.toISOString().split('T')[0];
    setRange('custom');
    setCustomRange({ start: startISO, end: endISO });
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

  const filteredDetails = useMemo(() => {
    const details = report?.records ?? [];
    if (!details.length) {
      return [];
    }
    const term = searchTerm.trim().toLowerCase();
    const minCount = Number(minApplications);
    const hasMin = !Number.isNaN(minCount) && minApplications !== '';
    return details.filter((entry) => {
      const recruiterName = entry?.recruiter?.name?.toLowerCase() ?? '';
      const candidateName = entry?.candidate?.name?.toLowerCase() ?? '';
      const matchesTerm = !term || recruiterName.includes(term) || candidateName.includes(term);
      const count = Number(entry?.applicationsCount || 0);
      const matchesMin = !hasMin || count >= minCount;
      return matchesTerm && matchesMin;
    });
  }, [minApplications, report, searchTerm]);
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
    >      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Reporting Window</p>
            <p className="text-sm text-muted-foreground">
              {dateFormatter.format(rangeConfig.startDate)} — {dateFormatter.format(rangeConfig.endDate)}
            </p>
            <p className="text-xs text-muted-foreground">Last updated {generatedLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Date range
          </p>
          <div className="flex flex-wrap items-center gap-2">
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
          {range === 'custom' ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="custom-start"
                    className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
                  >
                    Start date
                  </Label>
                  <Input
                    id="custom-start"
                    type="date"
                    value={customRange.start}
                    onChange={(event) =>
                      setCustomRange((prev) => ({ ...prev, start: event.target.value }))
                    }
                    max={customRange.end || undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="custom-end"
                    className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
                  >
                    End date
                  </Label>
                  <Input
                    id="custom-end"
                    type="date"
                    value={customRange.end}
                    onChange={(event) =>
                      setCustomRange((prev) => ({ ...prev, end: event.target.value }))
                    }
                    min={customRange.start || undefined}
                  />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Shortcuts
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCustomShortcut('week')}
                    >
                      This week
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCustomShortcut('month')}
                    >
                      This month
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCustomShortcut('quarter')}
                    >
                      Quarter to date
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCustomRange({ start: '', end: '' })}
                    >
                      Clear dates
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="activity-search" className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Quick search
          </Label>
          <Input
            id="activity-search"
            placeholder="Filter by recruiter or candidate name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-min" className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Minimum applications
          </Label>
          <Input
            id="activity-min"
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={minApplications}
            onChange={(event) => setMinApplications(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Active filters
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {!searchTerm && !minApplications ? (
              <span className="text-xs text-muted-foreground">None</span>
            ) : null}
            {searchTerm ? (
              <Badge variant="outline" className="text-xs">
                Search: {searchTerm}
              </Badge>
            ) : null}
            {minApplications ? (
              <Badge variant="outline" className="text-xs">
                â‰¥ {minApplications} apps
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 flex items-center justify-center text-muted-foreground">
          Loading application activityâ€¦
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total applications</p>
              <p className="text-2xl font-semibold text-foreground">
                {numberFormatter.format(totals.overall ?? 0)}
              </p>
              {reportRefreshing && <p className="text-xs text-muted-foreground mt-1">Refreshingâ€¦</p>}
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Top recruiter</p>
              <p className="text-lg font-medium text-foreground">
                {topRecruiter ? topRecruiter.recruiterName : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {topRecruiter
                  ? `${numberFormatter.format(topRecruiter.totalApplications)} applications`
                  : 'No data'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Top candidate</p>
              <p className="text-lg font-medium text-foreground">
                {topCandidate ? topCandidate.candidateName : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {topCandidate
                  ? `${numberFormatter.format(topCandidate.totalApplications)} applications`
                  : 'No data'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Busiest day</p>
              <p className="text-lg font-medium text-foreground">
                {peakDay ? dateFormatter.format(new Date(peakDay.date)) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {peakDay
                  ? `${numberFormatter.format(peakDay.totalApplications)} applications`
                  : 'No data'}
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Daily application trend</h3>
                <p className="text-xs text-muted-foreground">
                  Logged vs. approved submissions across the selected window.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {hasCustomRange ? 'Custom range' : rangeConfig.label}
              </Badge>
            </div>
            <ApplicationTrendChart data={totals.byDate ?? []} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Applications by recruiter</h3>
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(totals.byRecruiter?.length ?? 0)} recruiters
                </span>
              </div>
              {totals.byRecruiter?.length ? (
                <RecruiterBarChart data={totals.byRecruiter} />
              ) : (
                <EmptyState
                  icon={Users}
                  title="No recruiter activity"
                  description="No applications were logged by recruiters within this range."
                />
              )}
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Applications by candidate</h3>
                <span className="text-xs text-muted-foreground">
                  {numberFormatter.format(totals.byCandidate?.length ?? 0)} candidates
                </span>
              </div>
              {totals.byCandidate?.length ? (
                <CandidateBarChart data={totals.byCandidate} />
              ) : (
                <EmptyState
                  icon={UserCheck}
                  title="No candidate activity"
                  description="No candidate submissions were captured with the selected filters."
                />
              )}
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Detailed activity</h3>
              <span className="text-xs text-muted-foreground">
                {numberFormatter.format(filteredDetails.length)} record
                {filteredDetails.length === 1 ? '' : 's'}
              </span>
            </div>
            {filteredDetails.length ? (
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
                    {filteredDetails.map((entry, index) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No activity found"
                description="Try expanding the date range or clearing filters to see more data."
                action={
                  selectedRecruiter ||
                  selectedCandidate ||
                  searchTerm ||
                  minApplications ? (
                    <Button type="button" size="sm" variant="outline" onClick={handleClearFilters}>
                      Reset filters
                    </Button>
                  ) : null
                }
              />
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ApplicationActivityPage;












