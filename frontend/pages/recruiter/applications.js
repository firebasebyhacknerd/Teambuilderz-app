import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { FileText, Filter, Home, LogOut, Users, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  useApplicationsQuery,
  useCandidatesQuery,
  useLogApplicationMutation,
} from '../../lib/queryHooks';

const STATUS_OPTIONS = ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'];
const INTERVIEW_TYPES = ['phone', 'video', 'in_person', 'technical', 'hr', 'final'];

const ApplicationsPage = () => {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userName, setUserName] = useState('Recruiter');
  const [userRole, setUserRole] = useState('Recruiter');
  const [formMessage, setFormMessage] = useState(null);
  const [includeInterview, setIncludeInterview] = useState(false);
  const [includeAssessment, setIncludeAssessment] = useState(false);

  const createDefaultFormValues = () => ({
    candidateId: '',
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    channel: '',
    status: 'sent',
    applicationsCount: 1,
    applicationDate: new Date().toISOString().split('T')[0],
  });

  const [formValues, setFormValues] = useState(createDefaultFormValues);
  const [interviewDetails, setInterviewDetails] = useState({
    interviewType: 'phone',
    roundNumber: 1,
    scheduledDate: '',
    timezone: 'UTC',
    companyName: '',
  });
  const [assessmentDetails, setAssessmentDetails] = useState({
    assessmentPlatform: '',
    assessmentType: '',
    dueDate: '',
    notes: '',
  });

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
  };

  const handleInterviewChange = (field) => (event) => {
    const value = event.target.value;
    setInterviewDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssessmentChange = (field) => (event) => {
    const value = event.target.value;
    setAssessmentDetails((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormValues(createDefaultFormValues());
    setIncludeInterview(false);
    setIncludeAssessment(false);
    setInterviewDetails({
      interviewType: 'phone',
      roundNumber: 1,
      scheduledDate: '',
      timezone: 'UTC',
      companyName: '',
    });
    setAssessmentDetails({
      assessmentPlatform: '',
      assessmentType: '',
      dueDate: '',
      notes: '',
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!token || logApplication.isPending) return;

    setFormMessage(null);

    const trimmedCompany = formValues.companyName.trim();
    const trimmedJobTitle = formValues.jobTitle.trim();
    if (!formValues.candidateId || !trimmedCompany || !trimmedJobTitle) {
      setFormMessage({ type: 'error', text: 'Candidate, company, and job title are required.' });
      return;
    }

    if (includeInterview && (!interviewDetails.scheduledDate || !interviewDetails.interviewType)) {
      setFormMessage({
        type: 'error',
        text: 'Interview type and scheduled date are required when logging an interview.',
      });
      return;
    }

    if (includeAssessment && (!assessmentDetails.assessmentPlatform.trim() || !assessmentDetails.dueDate)) {
      setFormMessage({
        type: 'error',
        text: 'Assessment platform and due date are required when logging an assessment.',
      });
      return;
    }

    const applicationPayload = {
      candidate_id: Number(formValues.candidateId),
      company_name: trimmedCompany,
      job_title: trimmedJobTitle,
      job_description: formValues.jobDescription.trim() || undefined,
      channel: formValues.channel.trim() || undefined,
      status: formValues.status || 'sent',
      applications_count: Math.max(Number(formValues.applicationsCount) || 1, 1),
      application_date: formValues.applicationDate || undefined,
    };

    const interviewPayload =
      includeInterview
        ? {
            company_name: (interviewDetails.companyName || trimmedCompany).trim(),
            interview_type: interviewDetails.interviewType,
            round_number: Math.max(Number(interviewDetails.roundNumber) || 1, 1),
            scheduled_date: new Date(interviewDetails.scheduledDate).toISOString(),
            timezone: interviewDetails.timezone || 'UTC',
          }
        : null;

    const assessmentPayload =
      includeAssessment
        ? {
            assessment_platform: assessmentDetails.assessmentPlatform.trim(),
            assessment_type: assessmentDetails.assessmentType.trim() || undefined,
            due_date: assessmentDetails.dueDate,
            notes: assessmentDetails.notes.trim() || undefined,
          }
        : null;

    logApplication.mutate({
      application: applicationPayload,
      includeInterview,
      includeAssessment,
      interview: interviewPayload,
      assessment: assessmentPayload,
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
              Capture application details and optionally add interview or assessment records in one go.
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Candidate</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formValues.candidateId}
                  onChange={handleFormChange('candidateId')}
                >
                  <option value="">Select candidate</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Company</label>
                <Input
                  value={formValues.companyName}
                  onChange={handleFormChange('companyName')}
                  placeholder="Company name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Job Title</label>
                <Input
                  value={formValues.jobTitle}
                  onChange={handleFormChange('jobTitle')}
                  placeholder="Job title"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Channel</label>
                <Input
                  value={formValues.channel}
                  onChange={handleFormChange('channel')}
                  placeholder="LinkedIn, Email, Referral..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formValues.status}
                  onChange={handleFormChange('status')}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Applications Count</label>
                <Input
                  type="number"
                  min={1}
                  value={formValues.applicationsCount}
                  onChange={handleFormChange('applicationsCount')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Application Date</label>
                <Input
                  type="date"
                  value={formValues.applicationDate}
                  onChange={handleFormChange('applicationDate')}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Job Description / Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formValues.jobDescription}
                  onChange={handleFormChange('jobDescription')}
                  placeholder="Optional summary or additional notes"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                  checked={includeInterview}
                  onChange={(event) => setIncludeInterview(event.target.checked)}
                />
                Log follow-up interview details
              </label>

              {includeInterview && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Interview Type</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={interviewDetails.interviewType}
                      onChange={handleInterviewChange('interviewType')}
                    >
                      {INTERVIEW_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Round Number</label>
                    <Input
                      type="number"
                      min={1}
                      value={interviewDetails.roundNumber}
                      onChange={handleInterviewChange('roundNumber')}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Scheduled Date &amp; Time</label>
                    <Input
                      type="datetime-local"
                      value={interviewDetails.scheduledDate}
                      onChange={handleInterviewChange('scheduledDate')}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Timezone</label>
                    <Input
                      value={interviewDetails.timezone}
                      onChange={handleInterviewChange('timezone')}
                      placeholder="UTC, PST, EST..."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Interview Company (optional)</label>
                    <Input
                      value={interviewDetails.companyName}
                      onChange={handleInterviewChange('companyName')}
                      placeholder="Defaults to application company"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                  checked={includeAssessment}
                  onChange={(event) => setIncludeAssessment(event.target.checked)}
                />
                Log assessment assignment
              </label>

              {includeAssessment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Assessment Platform</label>
                    <Input
                      value={assessmentDetails.assessmentPlatform}
                      onChange={handleAssessmentChange('assessmentPlatform')}
                      placeholder="Coderbyte, HackerRank..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Assessment Type</label>
                    <Input
                      value={assessmentDetails.assessmentType}
                      onChange={handleAssessmentChange('assessmentType')}
                      placeholder="Technical, Personality..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Due Date</label>
                    <Input
                      type="date"
                      value={assessmentDetails.dueDate}
                      onChange={handleAssessmentChange('dueDate')}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Notes</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={assessmentDetails.notes}
                      onChange={handleAssessmentChange('notes')}
                      placeholder="Optional prep notes or instructions"
                    />
                  </div>
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
