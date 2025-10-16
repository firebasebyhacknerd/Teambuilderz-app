import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { FileText, Filter, Home, LogOut, Users, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import Textarea from '../../components/ui/textarea';
import {
  useApplicationsQuery,
  useCandidatesQuery,
  useLogApplicationMutation,
} from '../../lib/queryHooks';

const STATUS_OPTIONS = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];

const ApplicationsPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userName, setUserName] = useState('Recruiter');
  const [userRole, setUserRole] = useState('Recruiter');
  const [formMessage, setFormMessage] = useState(null);

  const createDefaultFormValues = () => ({
    candidateId: '',
    applicationsCount: 60,
    applicationDate: new Date().toISOString().split('T')[0],
    reductionReason: '',
  });

  const [formValues, setFormValues] = useState(createDefaultFormValues);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    setToken(storedToken);
    const storedRole = localStorage.getItem('userRole') || 'Recruiter';
    const storedName = localStorage.getItem('userName');
    setUserRole(storedRole);
    if (storedName) setUserName(storedName);
  }, [router]);

  const {
    data: applications = [],
    isLoading: applicationsLoading,
    isRefetching: applicationsRefetching,
  } = useApplicationsQuery(token);

  const {
    data: candidates = [],
    isLoading: candidatesLoading,
  } = useCandidatesQuery(token);

  const logApplication = useLogApplicationMutation(token, {
    onSuccess: () => {
      setFormMessage({ type: 'success', text: 'Application logged successfully.' });
      resetForm();
    },
    onError: (error) => {
      setFormMessage({ type: 'error', text: error.message || 'Unable to log application.' });
    },
  });
  const filteredApplications = useMemo(() => {
    const lowered = searchTerm.trim().toLowerCase();

    return applications.filter((app) => {
      const textMatches =
        !lowered ||
        [app.candidate_name, app.company_name, app.job_title, app.channel, app.status]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(lowered));

      const statusMatches = !statusFilter || app.status === statusFilter;
      return textMatches && statusMatches;
    });
  }, [applications, searchTerm, statusFilter]);

  const totalApplications = filteredApplications.reduce(
    (sum, app) => sum + (Number(app.applications_count) || 0),
    0
  );
  const needsReductionReason = Number(formValues.applicationsCount || 0) < 60;

  useEffect(() => {
    if (!needsReductionReason && formValues.reductionReason) {
      setFormValues((prev) => ({ ...prev, reductionReason: '' }));
    }
  }, [needsReductionReason, formValues.reductionReason]);

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

  const goToCandidate = (candidateId) => {
    if (!candidateId) return;
    router.push(`/recruiter/candidate/${candidateId}`);
  };

  const handleFormChange = (field) => (event) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (formMessage) setFormMessage(null);
  };

  const handlePresetCount = (count) => {
    setFormValues((prev) => ({ ...prev, applicationsCount: count }));
    if (formMessage) setFormMessage(null);
  };

  const resetForm = () => {
    setFormValues(createDefaultFormValues());
    setFormMessage(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!token || logApplication.isPending) return;

    setFormMessage(null);

    const applicationsCount = Math.max(Number(formValues.applicationsCount) || 0, 0);

    if (!formValues.candidateId) {
      setFormMessage({ type: 'error', text: 'Please select a candidate to attribute these applications.' });
      return;
    }

    if (applicationsCount < 60 && !formValues.reductionReason.trim()) {
      setFormMessage({
        type: 'error',
        text: 'Please provide a short reason when logging fewer than 60 applications.',
      });
      return;
    }

    const selectedCandidate = candidates.find((c) => c.id === Number(formValues.candidateId));
    const candidateLabel = selectedCandidate?.name || 'General Application';
    const reason = formValues.reductionReason.trim();

    const applicationPayload = {
      candidate_id: Number(formValues.candidateId),
      company_name: `${candidateLabel} Outreach`,
      job_title: 'General Application',
      job_description: reason ? `Reduced quota reason: ${reason}` : undefined,
      channel: 'Not specified',
      status: 'sent',
      applications_count: Math.max(applicationsCount, 0),
      application_date: formValues.applicationDate || undefined,
    };

    logApplication.mutate({
      application: applicationPayload,
      includeInterview: false,
      includeAssessment: false,
      interview: null,
      assessment: null,
    });
  };

  return (
    <DashboardLayout
      title="Applications"
      subtitle={`Overview of recent submissions${searchTerm ? ` matching "${searchTerm}"` : ''}`}
      links={sidebarLinks}
      actions={
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut size={16} />
          Logout
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Log New Application</h2>
            <p className="text-sm text-muted-foreground">
              Log today&apos;s outreach volume. Target is 60 applications—add a quick note if you logged fewer.
            </p>
          </div>

          {formMessage && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                formMessage.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {formMessage.text}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Candidate</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formValues.candidateId}
                  onChange={handleFormChange('candidateId')}
                  required
                >
                  <option value="">Select candidate</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Choose who you advanced today.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Applications Logged</label>
                <Input
                  type="number"
                  min={0}
                  value={formValues.applicationsCount}
                  onChange={handleFormChange('applicationsCount')}
                  required
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {[60, 80, 100].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePresetCount(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handlePresetCount(Math.max(0, (Number(formValues.applicationsCount) || 0) + 10))
                    }
                  >
                    +10
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date</label>
                <Input
                  type="date"
                  value={formValues.applicationDate}
                  onChange={handleFormChange('applicationDate')}
                  required
                />
              </div>

              {needsReductionReason && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Reason for fewer than 60 applications</label>
                  <Textarea
                    value={formValues.reductionReason}
                    onChange={handleFormChange('reductionReason')}
                    placeholder="Share why today's quota is reduced (e.g., interview day, sourcing research, PTO)."
                    rows={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Admins use this to track quota adjustments. Keep it brief but clear.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={logApplication.isPending}
              >
                Reset
              </Button>
              <Button type="submit" disabled={logApplication.isPending}>
                {logApplication.isPending ? 'Logging...' : 'Log Application'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <h2 className="text-xl font-semibold text-foreground">{userName}</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <Input
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <select
                className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Filtered Applications" value={filteredApplications.length} />
            <SummaryCard label="Total Count (Filtered)" value={totalApplications} />
            <SummaryCard label="Active Filters" value={statusFilter ? 1 : 0} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          {applicationsLoading || candidatesLoading || applicationsRefetching ? (
            <div className="p-6 text-center text-muted-foreground">Loading applications...</div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No applications found. Adjust filters or add a new submission.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Job Title</th>
                    <th className="px-4 py-3 text-left font-medium">Channel</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Applied On</th>
                    <th className="px-4 py-3 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => (
                    <tr
                      key={application.id}
                      className="border-b border-border hover:bg-accent/60 transition cursor-pointer"
                      onClick={() => goToCandidate(application.candidate_id)}
                    >
                      <td className="px-4 py-3 text-foreground">{application.candidate_name || '--'}</td>
                      <td className="px-4 py-3 text-foreground">{application.company_name || '--'}</td>
                      <td className="px-4 py-3 text-foreground">{application.job_title || '--'}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{application.channel || '--'}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{application.status || '--'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {application.application_date ? new Date(application.application_date).toLocaleDateString() : '--'}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {application.applications_count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
  </div>
);

export default ApplicationsPage;

