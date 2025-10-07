import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { User, Briefcase, Target, TrendingUp, Edit, Save, X, Home, FileText, AlertTriangle } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import API_URL from '../../../lib/api';

const sidebarLinks = [
  { href: '/recruiter', label: 'Dashboard', icon: Home },
  { href: '/recruiter/applications', label: 'Applications', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
];

const stageBadges = {
  onboarding: 'bg-blue-100 text-blue-800',
  marketing: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offered: 'bg-green-100 text-green-800',
  placed: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800'
};

const CandidateDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dailyApps, setDailyApps] = useState(0);
  const [totalApps, setTotalApps] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (id) {
      fetchCandidateDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCandidateDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/candidates`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        router.push('/login');
        return;
      }

      const candidates = await response.json();
      const candidateData = candidates.find((c) => c.id === parseInt(id, 10));

      if (candidateData) {
        setCandidate(candidateData);
        setDailyApps(candidateData.daily_applications || 0);
        setTotalApps(candidateData.total_applications || 0);
      }
    } catch (fetchError) {
      console.error('Error fetching candidate details:', fetchError);
      setError('Unable to load candidate information.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/v1/candidates/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          daily_applications: dailyApps,
          total_applications: totalApps
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to update candidate.');
      }

      setCandidate((prev) => ({
        ...prev,
        daily_applications: dailyApps,
        total_applications: totalApps
      }));
      setEditing(false);
      setError('');
    } catch (updateError) {
      console.error('Error updating candidate:', updateError);
      setError(updateError.message);
    }
  };

  const handleCancel = () => {
    setDailyApps(candidate.daily_applications || 0);
    setTotalApps(candidate.total_applications || 0);
    setEditing(false);
    setError('');
  };

  const stageLabel = useMemo(() => {
    if (!candidate?.current_stage) return 'N/A';
    return candidate.current_stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [candidate?.current_stage]);

  const primarySkill = useMemo(() => candidate?.skills?.[0] || 'N/A', [candidate?.skills]);

  if (loading) {
    return (
      <DashboardLayout title="Candidate Detail" links={sidebarLinks} onBack={() => router.push('/recruiter')}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading candidate...</div>
      </DashboardLayout>
    );
  }

  if (!candidate) {
    return (
      <DashboardLayout title="Candidate Detail" links={sidebarLinks} onBack={() => router.push('/recruiter')}>
        <div className="h-48 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
          <p>Candidate not found or no longer assigned.</p>
          <Button onClick={() => router.push('/recruiter')}>Back to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={candidate.name}
      subtitle={candidate.email}
      links={sidebarLinks}
      onBack={() => router.push('/recruiter')}
      actions={
        <Badge className={stageBadges[candidate.current_stage] ?? 'bg-blue-100 text-blue-800'}>{stageLabel}</Badge>
      }
    >
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Candidate Information</h2>
            {!editing ? (
              <Button size="sm" className="gap-2" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-600/90" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoTile icon={<User className="h-5 w-5 text-blue-600" />} label="Name" value={candidate.name} />
            <InfoTile icon={<Briefcase className="h-5 w-5 text-emerald-600" />} label="Primary Skill" value={primarySkill} />
            <InfoTile icon={<Target className="h-5 w-5 text-purple-600" />} label="Daily Applications" value={
              editing ? (
                <Input
                  type="number"
                  value={dailyApps}
                  onChange={(e) => setDailyApps(parseInt(e.target.value, 10) || 0)}
                  className="max-w-[120px]"
                />
              ) : (
                candidate.daily_applications || 0
              )
            } />
            <InfoTile icon={<TrendingUp className="h-5 w-5 text-orange-600" />} label="Total Applications" value={
              editing ? (
                <Input
                  type="number"
                  value={totalApps}
                  onChange={(e) => setTotalApps(parseInt(e.target.value, 10) || 0)}
                  className="max-w-[120px]"
                />
              ) : (
                candidate.total_applications || 0
              )
            } />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Performance Snapshot</h3>
          <StatBadge label="Today's Applications" value={candidate.daily_applications || 0} tone="bg-blue-100 text-blue-700" />
          <StatBadge label="Total Applications" value={candidate.total_applications || 0} tone="bg-green-100 text-green-700" />
          <StatBadge
            label="Daily vs Total"
            value={
              candidate.total_applications > 0
                ? Math.round(((candidate.daily_applications || 0) / candidate.total_applications) * 100)
                : 0
            }
            suffix="%"
            tone="bg-purple-100 text-purple-700"
          />
        </Card>
      </div>
    </DashboardLayout>
  );
};

const InfoTile = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
    <div className="rounded-md bg-background p-2 shadow-sm">{icon}</div>
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      {React.isValidElement(value) ? value : <span className="text-sm font-semibold text-foreground">{value}</span>}
    </div>
  </div>
);

const StatBadge = ({ label, value, suffix = '', tone }) => (
  <div className={`rounded-lg px-4 py-3 text-center ${tone ?? 'bg-muted text-foreground'}`}>
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="text-xl font-semibold text-foreground">
      {value}
      {suffix}
    </p>
  </div>
);

export default CandidateDetailPage;
