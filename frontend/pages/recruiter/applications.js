import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Plus,
  Search,
  Building,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  Home,
  FileText,
  AlertTriangle
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
  DialogTrigger,
  DialogClose
} from '../../components/ui/dialog';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import API_URL from '../../lib/api';

const statusMeta = {
  sent: { variant: 'outline', label: 'Sent' },
  viewed: { variant: 'outline', label: 'Viewed' },
  shortlisted: { variant: 'outline', label: 'Shortlisted' },
  interviewing: { variant: 'outline', label: 'Interviewing' },
  offered: { variant: 'outline', label: 'Offered' },
  hired: { variant: 'outline', label: 'Hired' },
  rejected: { variant: 'destructive', label: 'Rejected' }
};

const sidebarLinks = [
  { href: '/recruiter', label: 'Dashboard', icon: Home },
  { href: '/recruiter/applications', label: 'Applications', icon: FileText },
  { href: '/alerts', label: 'Alerts', icon: AlertTriangle }
];

const statusOrder = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];

const ApplicationsPage = () => {
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [applicationsRes, candidatesRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/applications`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/candidates`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (applicationsRes.status === 401 || applicationsRes.status === 403) {
        router.push('/login');
        return;
      }

      const applicationsData = await applicationsRes.json();
      const candidatesData = await candidatesRes.json();

      setApplications(applicationsData);
      setCandidates(candidatesData);
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError('Unable to load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredApplications = useMemo(() => {
    return applications
      .filter((application) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
          application.candidate_name?.toLowerCase().includes(term) ||
          application.company_name?.toLowerCase().includes(term) ||
          application.job_title?.toLowerCase().includes(term)
        );
      })
      .filter((application) => (statusFilter ? application.status === statusFilter : true))
      .filter((application) => (dateFilter ? application.application_date === dateFilter : true))
      .sort(
        (a, b) =>
          statusOrder.indexOf(a.status ?? 'sent') - statusOrder.indexOf(b.status ?? 'sent')
      );
  }, [applications, searchTerm, statusFilter, dateFilter]);

  const summary = useMemo(() => {
    return {
      total: applications.length,
      interviewing: applications.filter((a) => a.status === 'interviewing').length,
      offers: applications.filter((a) => a.status === 'offered').length,
      hires: applications.filter((a) => a.status === 'hired').length
    };
  }, [applications]);

  const handleSaveApplication = async (formData, resetForm) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = {
        ...formData,
        candidate_id: formData.candidate_id ? Number(formData.candidate_id) : null
      };

      const response = await fetch(`${API_URL}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create application.');
      }

      resetForm();
      setDialogOpen(false);
      await fetchData();
    } catch (saveError) {
      console.error('Error saving application:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <DialogTrigger asChild>
      <Button
        size="sm"
        className="gap-2"
        onClick={() => {
          setError('');
        }}
      >
        <Plus size={16} />
        Log Application
      </Button>
    </DialogTrigger>
  );

  if (loading) {
    return (
      <DashboardLayout title="Applications" subtitle="Manage candidates in the market" links={sidebarLinks}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading applications…</div>
      </DashboardLayout>
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setError('');
          setSaving(false);
        }
      }}
    >
      <DashboardLayout
        title="Applications"
        subtitle="Track progress of every candidate outreach"
        links={sidebarLinks}
        actions={actions}
      >
        {error && !dialogOpen && (
          <div className="mb-4 text-sm text-red-600 bg-red-100/80 border border-red-200 rounded-lg p-3">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard icon={<Briefcase size={22} />} title="Total Applications" value={summary.total} />
          <SummaryCard icon={<Clock size={22} />} title="Interviewing" value={summary.interviewing} tone="bg-blue-100 text-blue-700" />
          <SummaryCard icon={<CheckCircle size={22} />} title="Offers" value={summary.offers} tone="bg-green-100 text-green-700" />
          <SummaryCard icon={<XCircle size={22} />} title="Hires" value={summary.hires} tone="bg-purple-100 text-purple-700" />
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
                  placeholder="Search by candidate, company, or job title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All</option>
                {statusOrder.map((status) => (
                  <option key={status} value={status}>
                    {statusMeta[status]?.label ?? status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="dateFilter" className="text-xs text-muted-foreground uppercase tracking-wide">
                Application Date
              </Label>
              <Input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDateFilter('');
              }}>
                Reset Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusOrder.map((status) => (
              <Badge
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              >
                {statusMeta[status]?.label ?? status}
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
                  <th className="px-6 py-3">Company & Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Applied On</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-muted/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{application.candidate_name}</span>
                        <span className="text-xs text-muted-foreground">Recruiter: {application.recruiter_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-medium text-foreground">{application.job_title}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {application.company_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusMeta[application.status]?.variant ?? 'outline'}>
                        {statusMeta[application.status]?.label ?? application.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">
                        {application.application_date
                          ? new Date(application.application_date).toLocaleDateString()
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/recruiter/candidate/${application.candidate_id}`)}
                        >
                          <Briefcase className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Clock className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredApplications.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Briefcase size={48} className="mx-auto text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground">No applications match your filters</h3>
              <p className="text-sm text-muted-foreground">Adjust your search criteria to see more results.</p>
            </div>
          )}
        </Card>
      </DashboardLayout>

      <ApplicationDialog
        candidates={candidates}
        open={dialogOpen}
        error={error}
        isSaving={saving}
        onSubmit={handleSaveApplication}
      />
    </Dialog>
  );
};

const SummaryCard = ({ icon, title, value, tone }) => (
  <Card className="p-6 flex items-center gap-3">
    <div className={`h-11 w-11 rounded-full flex items-center justify-center ${tone ?? 'bg-primary/10 text-primary'}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </Card>
);

const ApplicationDialog = ({ candidates, open, error, isSaving, onSubmit }) => {
  const [formData, setFormData] = useState({
    candidate_id: '',
    company_name: '',
    job_title: '',
    job_description: '',
    channel: ''
  });

  useEffect(() => {
    if (!open) {
      setFormData({
        candidate_id: '',
        company_name: '',
        job_title: '',
        job_description: '',
        channel: ''
      });
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData, () =>
      setFormData({
        candidate_id: '',
        company_name: '',
        job_title: '',
        job_description: '',
        channel: ''
      })
    );
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Log New Application</DialogTitle>
        <DialogDescription>Capture a new outreach or application submission.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="candidate">Candidate</Label>
            <select
              id="candidate"
              value={formData.candidate_id}
              onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            >
              <option value="">Select Candidate</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="job_description">Job Description</Label>
          <textarea
            id="job_description"
            value={formData.job_description}
            onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="channel">Channel</Label>
          <Input
            id="channel"
            placeholder="e.g., LinkedIn, Indeed, Company Website"
            value={formData.channel}
            onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
          />
        </div>

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
            {isSaving ? 'Saving…' : 'Log Application'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default ApplicationsPage;
