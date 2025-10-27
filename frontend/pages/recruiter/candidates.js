import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Users, Home, FileText, AlertTriangle, LogOut, Search, ChevronRight } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useCandidatesQuery } from '../../lib/queryHooks';

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

const CandidatesPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userName, setUserName] = useState('Recruiter');
  const [userRole, setUserRole] = useState('Recruiter');
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!searchTerm.trim()) return candidates;
    const term = searchTerm.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const name = (candidate.name || '').toLowerCase();
      const email = (candidate.email || '').toLowerCase();
      const stage = (candidate.current_stage || '').toLowerCase();
      return name.includes(term) || email.includes(term) || stage.includes(term);
    });
  }, [candidates, searchTerm]);

  const sidebarLinks = useMemo(() => {
    if (userRole === 'Admin') {
      return [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/candidates', label: 'Candidates', icon: Users },
        { href: '/recruiter/applications', label: 'Applications', icon: FileText },
        { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
      ];
    }

    return [
      { href: '/recruiter', label: 'Dashboard', icon: Home },
      { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    ];
  }, [userRole]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    router.push('/login');
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

        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Loading candidates...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No candidates matched your filters.
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
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6">
                    <Badge className={badgeTone}>{stageLabel}</Badge>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {candidate.daily_applications || 0}
                      </span>{' '}
                      apps today &middot;{' '}
                      <span className="font-semibold text-foreground">
                        {candidate.total_applications || 0}
                      </span>{' '}
                      total
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
