import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { User, Users, FileText, Target, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { useRecruiterProfileQuery } from '../../../lib/queryHooks';

const buildSidebarLinks = (role) => {
  if (role === 'Admin') {
    return [
      { href: '/admin', label: 'Dashboard', icon: Users },
      { href: '/admin/candidates', label: 'Candidates', icon: User },
      { href: '/recruiter/applications', label: 'Applications', icon: FileText },
      { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
    ];
  }

  return [
    { href: '/recruiter', label: 'Dashboard', icon: Target },
    { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
    { href: '/recruiter/applications', label: 'Applications', icon: FileText },
    { href: '/alerts', label: 'Alerts', icon: AlertTriangle },
  ];
};

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
    <span className="text-sm font-medium text-foreground">{value ?? '—'}</span>
  </div>
);

const RecruiterProfilePage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('Recruiter');

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

  const {
    data: profileData,
    isLoading,
    isFetching,
    error,
  } = useRecruiterProfileQuery(token, recruiterId, Boolean(token && recruiterId));

  const sidebarLinks = useMemo(() => buildSidebarLinks(userRole), [userRole]);

  const isBusy = isLoading || isFetching;

  return (
    <DashboardLayout
      title={profileData?.user?.name ? `${profileData.user.name}` : 'Recruiter Profile'}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
              <p className="text-sm text-muted-foreground">Core information and access level.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <InfoRow label="Name" value={profileData.user.name} />
              <InfoRow label="Email" value={profileData.user.email} />
              <InfoRow label="Role" value={profileData.user.role} />
              <InfoRow label="Daily Quota" value={profileData.user.daily_quota ?? 'Not set'} />
              <div className="flex items-center gap-2">
                <InfoRow label="Status" value={profileData.user.is_active ? 'Active' : 'Inactive'} />
                <Badge variant={profileData.user.is_active ? 'default' : 'outline'}>
                  {profileData.user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <InfoRow
                label="Joined"
                value={profileData.user.created_at ? new Date(profileData.user.created_at).toLocaleDateString() : 'N/A'}
              />
              <InfoRow
                label="Last Updated"
                value={profileData.user.updated_at ? new Date(profileData.user.updated_at).toLocaleDateString() : 'N/A'}
              />
            </div>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Applications"
              metrics={{
                total: profileData.metrics.applications.total,
                approved: profileData.metrics.applications.approved,
                pending: profileData.metrics.applications.pending,
              }}
            />
            <MetricCard
              title="Interviews"
              metrics={{
                total: profileData.metrics.interviews.total,
                approved: profileData.metrics.interviews.approved,
                pending: profileData.metrics.interviews.pending,
              }}
            />
            <MetricCard
              title="Assessments"
              metrics={{
                total: profileData.metrics.assessments.total,
                approved: profileData.metrics.assessments.approved,
                pending: profileData.metrics.assessments.pending,
              }}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RecruiterProfilePage;

