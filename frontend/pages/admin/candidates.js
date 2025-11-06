import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Home,
  FileText,
  AlertTriangle,
  User,
  BarChart3,
  TrendingUp,
  CircleUser,
  Loader2,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '../../components/ui/dialog';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';
import { useCandidateAssignmentsQuery } from '../../lib/queryHooks';
import { track } from '../../lib/analytics';

const stageBadges = {
  onboarding: 'bg-blue-100 text-blue-800',
  marketing: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offered: 'bg-green-100 text-green-800',
  placed: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800'
};

const stages = Object.keys(stageBadges);

const sidebarLinks = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/candidates', label: 'Candidates', icon: Users },
  { href: '/admin/recruiters', label: 'Team Management', icon: UserCheck },
  { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
  { href: '/admin/application-activity', label: 'Application Activity', icon: BarChart3 },
  { href: '/recruiter/applications', label: 'Applications', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { href: '/profile', label: 'My Profile', icon: CircleUser }
];

const filterPresets = [
  { id: 'new-talent', label: 'New Talent', stage: 'onboarding', source: 'default' },
  { id: 'market-ready', label: 'Market Ready', stage: 'marketing', source: 'default' },
  { id: 'interviewing', label: 'Interview Pipeline', stage: 'interviewing', source: 'default' },
  { id: 'offers', label: 'Offers & Placements', stage: 'offered', source: 'default' },
];

const AdminCandidates = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('Admin');
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recentFilters, setRecentFilters] = useState([]);
  const filterHistoryRef = useRef(false);

  const openCreateDialog = () => {
    setEditingCandidate(null);
    setError('');
    setDialogOpen(true);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('userRole');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    if (!storedRole || storedRole !== 'Admin') {
      router.replace('/recruiter');
      return;
    }
    setUserRole(storedRole);
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const candidatesRes = await fetch(`${API_URL}/api/v1/candidates`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (candidatesRes.status === 401) {
        router.push('/login');
        return;
      }

      if (candidatesRes.status === 403) {
        setError('You do not have permission to view this candidate list.');
        setLoading(false);
        return;
      }

      const candidatesData = await candidatesRes.json();
      setCandidates(candidatesData);

      if (userRole === 'Admin') {
        const recruitersRes = await fetch(`${API_URL}/api/v1/users`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (recruitersRes.ok) {
          const recruitersData = await recruitersRes.json();
          setRecruiters(recruitersData.filter((u) => u.role === 'Recruiter'));
        } else {
          console.error('Unable to load recruiter list');
          setRecruiters([]);
        }
      } else {
        setRecruiters([]);
      }
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError('Unable to load candidates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, userRole, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stageLabel = useCallback(
    (stage) => (stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'All Stages'),
    [],
  );

  const getRecruiterName = useCallback(
    (id) => recruiters.find((recruiter) => String(recruiter.id) === String(id))?.name ?? 'All Recruiters',
    [recruiters],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStageFilter('');
    setRecruiterFilter('');
  }, [setSearchTerm, setStageFilter, setRecruiterFilter]);

  const applyFilterPreset = useCallback(
    (preset) => {
      setStageFilter(preset.stage ?? '');
      setRecruiterFilter(preset.recruiter ?? '');
      if (preset.searchTerm !== undefined) {
        setSearchTerm(preset.searchTerm);
      }
      track('admin_filter_preset_clicked', {
        presetId: preset.id,
        stage: preset.stage ?? null,
        recruiter: preset.recruiter ?? null,
        source: preset.source ?? 'custom',
      });
    },
    [setStageFilter, setRecruiterFilter, setSearchTerm],
  );

  const presetIsActive = useCallback(
    (preset) => stageFilter === (preset.stage ?? '') && recruiterFilter === (preset.recruiter ?? ''),
    [stageFilter, recruiterFilter],
  );

  const applyRecentFilter = useCallback(
    (entry) => {
      setStageFilter(entry.stage || '');
      setRecruiterFilter(entry.recruiter || '');
      track('admin_recent_filter_clicked', {
        signature: entry.signature,
        stage: entry.stage ?? null,
        recruiter: entry.recruiter ?? null,
      });
    },
    [setStageFilter, setRecruiterFilter],
  );

  useEffect(() => {
    if (!filterHistoryRef.current) {
      filterHistoryRef.current = true;
      return;
    }

    const signature = `${stageFilter || 'all'}::${recruiterFilter || 'all'}`;
    if (signature === 'all::all') {
      return;
    }

    const labelParts = [stageLabel(stageFilter)];
    labelParts.push(recruiterFilter ? getRecruiterName(recruiterFilter) : 'All Recruiters');
    const label = labelParts.join(' · ');

    setRecentFilters((prev) => {
      const withoutCurrent = prev.filter((entry) => entry.signature !== signature);
      return [
        { signature, label, stage: stageFilter, recruiter: recruiterFilter },
        ...withoutCurrent,
      ].slice(0, 4);
    });
  }, [stageFilter, recruiterFilter, getRecruiterName, stageLabel]);

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((candidate) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
          candidate.name?.toLowerCase().includes(term) ||
          candidate.email?.toLowerCase().includes(term) ||
          candidate.recruiter_name?.toLowerCase().includes(term)
        );
      })
      .filter((candidate) => (stageFilter ? candidate.current_stage === stageFilter : true))
      .filter((candidate) => (recruiterFilter ? String(candidate.assigned_recruiter_id) === recruiterFilter : true));
  }, [candidates, searchTerm, stageFilter, recruiterFilter]);

  const summary = useMemo(() => {
    const stageCounts = candidates.reduce((acc, candidate) => {
      const stageKey = candidate.current_stage || 'unassigned';
      acc[stageKey] = (acc[stageKey] || 0) + 1;
      return acc;
    }, {});

    const activeCount = candidates.filter((candidate) => candidate.current_stage !== 'inactive').length;
    return {
      total: candidates.length,
      active: activeCount,
      inactive: candidates.length - activeCount,
      recruiters: new Set(candidates.map((candidate) => candidate.recruiter_name).filter(Boolean)).size,
      stageCounts
    };
  }, [candidates]);

  const smartPresets = useMemo(() => {
    if (!summary.stageCounts) {
      return [];
    }

    const suggestions = [];
    const entries = Object.entries(summary.stageCounts);

    const topActiveStage = entries
      .filter(([stage]) => stage !== 'inactive')
      .sort((a, b) => b[1] - a[1])[0];

    if (topActiveStage) {
      const [stage, count] = topActiveStage;
      suggestions.push({
        id: `smart-top-${stage}`,
        label: `High Volume: ${stageLabel(stage)}`,
        stage,
        badge: `${count} candidates`,
        source: 'smart',
      });
    }

    const inactiveCount = summary.stageCounts.inactive;
    if (inactiveCount) {
      suggestions.push({
        id: 'smart-reengage',
        label: 'Re-engage Inactive',
        stage: 'inactive',
        badge: `${inactiveCount} need attention`,
        source: 'smart',
      });
    }

    const marketingCount = summary.stageCounts.marketing;
    if (marketingCount && marketingCount >= 3 && (!topActiveStage || topActiveStage[0] !== 'marketing')) {
      suggestions.push({
        id: 'smart-marketing',
        label: 'Marketing Push',
        stage: 'marketing',
        badge: `${marketingCount} actively marketing`,
        source: 'smart',
      });
    }

    return suggestions.slice(0, 3);
  }, [summary.stageCounts, stageLabel]);

  const handleCandidateSave = async (formData, resetForm) => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      router.push('/login');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        ...formData,
        experience_years: formData.experience_years ? Number(formData.experience_years) : null,
        assigned_recruiter_id: formData.assigned_recruiter_id ? Number(formData.assigned_recruiter_id) : null,
        skills: formData.skills || []
      };

      const isEditing = Boolean(editingCandidate);
      const endpoint = isEditing ? `/api/v1/candidates/${editingCandidate.id}` : '/api/v1/candidates';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to save candidate.');
      }

      resetForm();
      setDialogOpen(false);
      setEditingCandidate(null);
      await fetchData();
    } catch (saveError) {
      console.error('Error saving candidate:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    const confirmed = window.confirm('Are you sure you want to delete this candidate? This action cannot be undone.');
    if (!confirmed) return;

    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      router.push('/login');
      return;
    }

    try {
      setError('');
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete candidate.');
      }

      await fetchData();
    } catch (deleteError) {
      console.error('Error deleting candidate:', deleteError);
      setError(deleteError.message);
    }
  };

  const handleRecruiterLinkClick = (event, recruiterId) => {
    event.stopPropagation();
    if (!recruiterId) return;
    router.push(`/recruiter/profile/${recruiterId}`);
  };

  const actions = (
    <Button
      size="sm"
      className="gap-2"
      onClick={openCreateDialog}
    >
      <Plus size={16} />
      Add Candidate
    </Button>
  );

  if (loading) {
    return (
      <DashboardLayout title="Candidate Management" subtitle="Loading assigned candidates" links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading candidates...</div>
      </DashboardLayout>
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingCandidate(null);
          setError('');
          setSaving(false);
        }
      }}
    >
      <DashboardLayout
        title="Candidate Management"
        subtitle="Assign, track, and stage candidates across the pipeline"
        links={sidebarLinks}
        onBack={() => router.push('/admin')}
        actions={actions}
      >
        {error && !dialogOpen && (
          <div className="mb-4 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard icon={<Users className="h-5 w-5 text-blue-600" />} title="Total Candidates" value={summary.total} accent="bg-blue-100 text-blue-700" />
          <SummaryCard icon={<Users className="h-5 w-5 text-emerald-600" />} title="Active" value={summary.active} accent="bg-emerald-100 text-emerald-700" />
          <SummaryCard icon={<Users className="h-5 w-5 text-gray-600" />} title="Inactive" value={summary.inactive} accent="bg-gray-100 text-gray-700" />
          <SummaryCard icon={<Users className="h-5 w-5 text-purple-600" />} title="Recruiters Engaged" value={summary.recruiters} accent="bg-purple-100 text-purple-700" />
        </div>

        <Card className="p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search" className="text-xs text-muted-foreground uppercase tracking-wide">
                Search
              </Label>
              <div className="mt-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or recruiter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Stage</Label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All Stages</option>
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabel(stage)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Recruiter</Label>
              <select
                value={recruiterFilter}
                onChange={(e) => setRecruiterFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All Recruiters</option>
                {recruiters.map((recruiter) => (
                  <option key={recruiter.id} value={recruiter.id}>
                    {recruiter.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 justify-end">
              <Button variant="outline" className="gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Add Candidate
              </Button>
              <Button
                variant="ghost"
                onClick={clearFilters}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved Presets</span>
            {filterPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={presetIsActive(preset) ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => applyFilterPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {smartPresets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Smart Suggestions</span>
              {smartPresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={presetIsActive(preset) ? 'default' : 'secondary'}
                  className="h-7 text-xs"
                  onClick={() => applyFilterPreset(preset)}
                  title={preset.badge}
                >
                  {preset.label}
                  {preset.badge && <span className="ml-2 text-[10px] uppercase tracking-wide">{preset.badge}</span>}
                </Button>
              ))}
            </div>
          )}

          {recentFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recently Used</span>
              {recentFilters.map((entry) => (
                <Badge
                  key={entry.signature}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/10 transition"
                  onClick={() => applyRecentFilter(entry)}
                >
                  {entry.label}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {stages.map((stage) => (
              <Badge
                key={stage}
                variant={stageFilter === stage ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
              >
                {stageLabel(stage)}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Stage</th>
                  <th className="px-6 py-3">Recruiter</th>
                  <th className="px-6 py-3">Applications</th>
                  <th className="px-6 py-3">Skills</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-muted/30 transition cursor-pointer"
                    onClick={() => router.push(`/recruiter/candidate/${candidate.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{candidate.name}</p>
                          <p className="text-xs text-muted-foreground">{candidate.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={stageBadges[candidate.current_stage] ?? 'bg-blue-100 text-blue-800'}>
                        {candidate.current_stage}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {candidate.assigned_recruiter_id ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={(event) => handleRecruiterLinkClick(event, candidate.assigned_recruiter_id)}
                        >
                          {candidate.recruiter_name || 'Recruiter'}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <div className="flex flex-col">
                        <span className="font-medium">{candidate.total_applications || 0} total</span>
                        <span className="text-xs text-muted-foreground">
                          {candidate.approved_applications || 0} approved | {candidate.pending_applications || 0} pending
                        </span>
                        <span className="text-xs text-muted-foreground">{candidate.daily_applications || 0} today</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {(candidate.skills || []).slice(0, 3).map((skill) => (
                          <Badge key={skill} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills && candidate.skills.length > 3 && (
                          <span>+{candidate.skills.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCandidate(candidate);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCandidate(candidate.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCandidates.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Users size={48} className="mx-auto text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground">No candidates match your filters</h3>
              <p className="text-sm text-muted-foreground">Adjust your filters or add a new candidate.</p>
              <Button className="mt-2 gap-2" onClick={openCreateDialog}>
                <Plus size={14} />
                Add Candidate
              </Button>
            </div>
          )}
        </Card>
      </DashboardLayout>

      <CandidateDialog
        open={dialogOpen}
        token={token}
        candidate={editingCandidate}
        recruiters={recruiters}
        error={error}
        isSaving={saving}
        onSubmit={handleCandidateSave}
      />
    </Dialog>
  );
};

const SummaryCard = ({ icon, title, value, accent }) => (
  <Card className="p-5 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${accent ?? 'bg-muted text-foreground'}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </Card>
);

const CandidateDialog = ({ token, open, candidate, recruiters, error, isSaving, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    visa_status: '',
    skills: [],
    experience_years: '',
    current_stage: 'onboarding',
    assigned_recruiter_id: ''
  });
  const { data: assignments = [], isLoading: assignmentsLoading } = useCandidateAssignmentsQuery(
    token,
    candidate?.id,
    Boolean(token && open && candidate?.id),
  );
  const assignmentFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    [],
  );

  useEffect(() => {
    if (candidate) {
      setFormData({
        name: candidate.name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        visa_status: candidate.visa_status || '',
        skills: candidate.skills || [],
        experience_years: candidate.experience_years || '',
        current_stage: candidate.current_stage || 'onboarding',
        assigned_recruiter_id: candidate.assigned_recruiter_id ? String(candidate.assigned_recruiter_id) : ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        visa_status: '',
        skills: [],
        experience_years: '',
        current_stage: 'onboarding',
        assigned_recruiter_id: ''
      });
    }
  }, [candidate, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(
      formData,
      () =>
        setFormData({
          name: '',
          email: '',
          phone: '',
          visa_status: '',
          skills: [],
          experience_years: '',
          current_stage: 'onboarding',
          assigned_recruiter_id: ''
        })
    );
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{candidate ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
        <DialogDescription>Maintain accurate candidate records and recruiter assignments.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="visa_status">Visa Status</Label>
            <Input
              id="visa_status"
              value={formData.visa_status}
              onChange={(e) => setFormData({ ...formData, visa_status: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="experience_years">Experience (Years)</Label>
            <Input
              id="experience_years"
              type="number"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="current_stage">Current Stage</Label>
            <select
              id="current_stage"
              value={formData.current_stage}
              onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabel(stage)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="assigned_recruiter_id">Assigned Recruiter</Label>
            <select
              id="assigned_recruiter_id"
              value={formData.assigned_recruiter_id}
              onChange={(e) => setFormData({ ...formData, assigned_recruiter_id: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Select Recruiter</option>
              {recruiters.map((recruiter) => (
                <option key={recruiter.id} value={recruiter.id}>
                  {recruiter.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="skills">Skills (comma separated)</Label>
          <Input
            id="skills"
            placeholder="React, Node.js, Python..."
            value={formData.skills.join(', ')}
            onChange={(e) =>
              setFormData({
                ...formData,
                skills: e.target.value
                  .split(',')
                  .map((skill) => skill.trim())
                  .filter((skill) => skill.length > 0)
              })
            }
          />
        </div>

        {candidate && (
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Assignment History</h4>
            {assignmentsLoading ? (
              <p className="text-xs text-muted-foreground">Loading assignment history...</p>
            ) : assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assignment history recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((entry) => {
                  const assignedLabel = entry.recruiter?.name ?? 'Unassigned';
                  const assignedAtLabel = entry.assignedAt
                    ? assignmentFormatter.format(new Date(entry.assignedAt))
                    : 'Unknown';
                  const unassignedAtLabel = entry.unassignedAt
                    ? assignmentFormatter.format(new Date(entry.unassignedAt))
                    : null;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs flex flex-col gap-1"
                    >
                      <span className="font-medium text-foreground">{assignedLabel}</span>
                      <span className="text-muted-foreground">Assigned {assignedAtLabel}</span>
                      {entry.assignedBy?.name && (
                        <span className="text-muted-foreground">By {entry.assignedBy.name}</span>
                      )}
                      <span className="text-muted-foreground">
                        {unassignedAtLabel ? `Unassigned ${unassignedAtLabel}` : 'Current assignment'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : candidate ? 'Update Candidate' : 'Create Candidate'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default AdminCandidates;
