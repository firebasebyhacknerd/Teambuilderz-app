import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
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
  { href: '/admin/recruiters', label: 'Team Management', icon: User },
  { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
  { href: '/recruiter/applications', label: 'Applications', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
];

const AdminCandidates = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
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

  const openCreateDialog = () => {
    setEditingCandidate(null);
    setError('');
    setDialogOpen(true);
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [candidatesRes, recruitersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/candidates`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/users`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (candidatesRes.status === 401 || candidatesRes.status === 403) {
        router.push('/login');
        return;
      }

      const candidatesData = await candidatesRes.json();
      const recruitersData = await recruitersRes.json();

      setCandidates(candidatesData);
      setRecruiters(recruitersData.filter((u) => u.role === 'Recruiter'));
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError('Unable to load candidates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const activeCount = candidates.filter((candidate) => candidate.current_stage !== 'inactive').length;
    return {
      total: candidates.length,
      active: activeCount,
      inactive: candidates.length - activeCount,
      recruiters: new Set(candidates.map((candidate) => candidate.recruiter_name).filter(Boolean)).size
    };
  }, [candidates]);

  const handleCandidateSave = async (formData, resetForm) => {
    if (!token) {
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
        headers: {
          Authorization: `Bearer ${token}`,
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

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setError('');
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
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
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading candidatesâ€¦</div>
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
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
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
                onClick={() => {
                  setSearchTerm('');
                  setStageFilter('');
                  setRecruiterFilter('');
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stages.map((stage) => (
              <Badge
                key={stage}
                variant={stageFilter === stage ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
              >
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
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
                    <td className="px-6 py-4 text-sm text-foreground">{candidate.recruiter_name || 'Unassigned'}</td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <div className="flex flex-col">
                        <span className="font-medium">{candidate.total_applications || 0} total</span>
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
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
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
            {isSaving ? 'Savingâ€¦' : candidate ? 'Update Candidate' : 'Create Candidate'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default AdminCandidates;




