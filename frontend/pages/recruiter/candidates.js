import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { Users, Home, FileText, AlertTriangle, CircleUser, LogOut, Search, ChevronRight } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { useCandidatesQuery } from '../../lib/queryHooks';
import API_URL from '../../lib/api';

const stageStyles = {
  onboarding: 'bg-blue-100 text-blue-700',
  marketing: 'bg-yellow-100 text-yellow-700',
  interviewing: 'bg-purple-100 text-purple-700',
  offered: 'bg-emerald-100 text-emerald-700',
  placed: 'bg-emerald-200 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-700',
};

const stageLabels = {
  onboarding: 'Onboarding',
  marketing: 'Marketing',
  interviewing: 'Interviewing',
  offered: 'Offered',
  placed: 'Placed',
  inactive: 'Inactive',
};

const stageOptions = Object.entries(stageLabels).map(([value, label]) => ({ value, label }));

const CandidatesPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Recruiter');
  const [userRole, setUserRole] = useState('Recruiter');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);

    const storedRole = localStorage.getItem('userRole');
    if (storedRole) setUserRole(storedRole);

    const storedName = localStorage.getItem('userName');
    if (storedName) setUserName(storedName);
  }, [router]);

  const { data: candidates = [], isLoading } = useCandidatesQuery(token, Boolean(token));

  const filteredCandidates = useMemo(() => {
    if (!candidates.length) {
      return [];
    }
    const term = searchTerm.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const name = (candidate.name || '').toLowerCase();
      const email = (candidate.email || '').toLowerCase();
      const stage = (candidate.current_stage || '').toLowerCase();
      const assigned = Boolean(candidate.assigned_recruiter_id);
      const matchesSearch = !term || name.includes(term) || email.includes(term) || stage.includes(term);
      const matchesStage = stageFilter === 'all' || stage === stageFilter;
      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned' && assigned) ||
        (assignmentFilter === 'unassigned' && !assigned);
      return matchesSearch && matchesStage && matchesAssignment;
    });
  }, [assignmentFilter, candidates, searchTerm, stageFilter]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) || stageFilter !== 'all' || assignmentFilter !== 'all';

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setStageFilter('all');
    setAssignmentFilter('all');
  }, []);

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Admin') {
      return [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/candidates', label: 'Candidates', icon: Users },
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
    } catch (logoutError) {
      console.warn('Failed to log out cleanly', logoutError);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
  };

  const handleRecruiterLinkClick = (event, recruiterId) => {
    event.stopPropagation();
    if (!recruiterId) return;
    router.push(`/recruiter/profile/${recruiterId}`);
  };

  return (
    <DashboardLayout
      title="My Candidates"
      subtitle={`Hello ${userName}, ${filteredCandidates.length} candidate${filteredCandidates.length === 1 ? '' : 's'} in view.`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      }
    >
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Candidate Directory</h2>
            <p className="text-sm text-muted-foreground">
              Review assignments, monitor progress, and jump into candidate detail quickly.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              placeholder="Search by name, email, or stage"
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label
              htmlFor="candidate-stage-filter"
              className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
            >
              Stage
            </Label>
            <select
              id="candidate-stage-filter"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
            >
              <option value="all">All stages</option>
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="candidate-assignment-filter"
              className="text-xs font-semibold uppercase text-muted-foreground tracking-wide"
            >
              Assignment
            </Label>
            <select
              id="candidate-assignment-filter"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Active filters
            </Label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {hasActiveFilters ? null : <span className="text-muted-foreground">None</span>}
              {stageFilter !== 'all' ? (
                <Badge variant="outline" className="text-xs">
                  Stage: {stageLabels[stageFilter]}
                </Badge>
              ) : null}
              {assignmentFilter !== 'all' ? (
                <Badge variant="outline" className="text-xs">
                  {assignmentFilter === 'assigned' ? 'Assigned only' : 'Unassigned only'}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {filteredCandidates.length} candidate{filteredCandidates.length === 1 ? '' : 's'} match the current filters.
            </span>
            <Button type="button" variant="ghost" size="xs" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Loading candidates...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground space-y-3">
            <p>No candidates matched your filters.</p>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card/70">
            {filteredCandidates.map((candidate) => {
              const stage = candidate.current_stage || 'onboarding';
              const badgeTone = stageStyles[stage] ?? 'bg-slate-100 text-slate-700';
              const stageLabel = stageLabels[stage] || stage;

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                  className="w-full text-left px-4 py-3 sm:px-6 sm:py-4 hover:bg-accent transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground">{candidate.email || 'No email on record'}</p>
                    {candidate.assigned_recruiter_id ? (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary hover:underline"
                        onClick={(event) => handleRecruiterLinkClick(event, candidate.assigned_recruiter_id)}
                      >
                        Assigned to {candidate.recruiter_name || 'Recruiter'}
                      </button>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Unassigned</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6">
                    <Badge className={badgeTone}>{stageLabel}</Badge>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {candidate.daily_applications || 0}
                      </span>{' '}
                      today &middot;{' '}
                      <span className="font-semibold text-emerald-600">
                        {candidate.approved_applications || 0}
                      </span>{' '}
                      approved &middot;{' '}
                      <span className="font-semibold text-amber-600">
                        {candidate.pending_applications || 0}
                      </span>{' '}
                      pending
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
};

export default CandidatesPage;

