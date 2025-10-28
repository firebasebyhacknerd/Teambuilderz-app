import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { FileText, Filter, Home, LogOut, Users, AlertTriangle, TrendingUp, Edit, Check, X } from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import Textarea from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  useApplicationsQuery,
  useCandidatesQuery,
  useLogApplicationMutation,
  useInterviewsQuery,
  useAssessmentsQuery,
  useUpdateApplicationMutation,
  useApproveApplicationMutation,
  useDeleteApplicationMutation,
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
  const [editingApplicationId, setEditingApplicationId] = useState(null);
  const [editingApplicationsCount, setEditingApplicationsCount] = useState('');
  const [editMessage, setEditMessage] = useState(null);

  const createDefaultFormValues = () => ({
    candidateId: '',
    applicationsCount: 60,
    applicationDate: new Date().toISOString().split('T')[0],
    reductionReason: '',
    includeInterview: false,
    interviewCompany: '',
    interviewDate: '',
    interviewType: 'phone',
    interviewRound: '1',
    interviewTimezone: 'UTC',
    interviewNotes: '',
    includeAssessment: false,
    assessmentPlatform: '',
    assessmentType: 'technical',
    assessmentDueDate: '',
    assessmentNotes: '',
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

  useEffect(() => {
    if (typeof Intl === 'undefined') return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    setFormValues((prev) => {
      if (prev.interviewTimezone && prev.interviewTimezone !== 'UTC') {
        return prev;
      }
      return { ...prev, interviewTimezone: timezone };
    });
  }, []);

  const {
    data: applications = [],
    isLoading: applicationsLoading,
    isRefetching: applicationsRefetching,
  } = useApplicationsQuery(token);

  const {
    data: candidates = [],
    isLoading: candidatesLoading,
  } = useCandidatesQuery(token);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const interviewQueryParams = useMemo(
    () => ({ date_from: today, status: 'scheduled' }),
    [today],
  );

  const assessmentQueryParams = useMemo(
    () => ({ status: 'assigned' }),
    [],
  );

  const {
    data: interviews = [],
    isLoading: interviewsLoading,
    isRefetching: interviewsRefetching,
  } = useInterviewsQuery(token, interviewQueryParams, Boolean(token));

  const {
    data: assessments = [],
    isLoading: assessmentsLoading,
    isRefetching: assessmentsRefetching,
  } = useAssessmentsQuery(token, assessmentQueryParams, Boolean(token));

  const updateApplication = useUpdateApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application updated successfully.' });
      setEditingApplicationId(null);
      setEditingApplicationsCount('');
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to update application.',
      });
    },
  });

  const approveApplication = useApproveApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application approval updated.' });
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to update approval.',
      });
    },
  });

  const deleteApplication = useDeleteApplicationMutation(token, {
    onSuccess: () => {
      setEditMessage({ type: 'success', text: 'Application rejected and removed.' });
      if (editingApplicationId) {
        setEditingApplicationId(null);
        setEditingApplicationsCount('');
      }
    },
    onError: (error) => {
      setEditMessage({
        type: 'error',
        text: error.message || 'Unable to reject application.',
      });
    },
  });

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

  const filteredApprovalSummary = useMemo(() => {
    return filteredApplications.reduce(
      (acc, app) => {
        const count = Number(app.applications_count) || 0;
        acc.total += count;
        if (app.is_approved) {
          acc.approved += count;
          acc.approvedRecords += 1;
        } else {
          acc.pending += count;
          acc.pendingRecords += 1;
        }
        return acc;
      },
      { total: 0, approved: 0, pending: 0, approvedRecords: 0, pendingRecords: 0 }
    );
  }, [filteredApplications]);
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
        { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
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

  const goToCandidate = (candidateId) => {
    if (!candidateId) return;
    router.push(`/recruiter/candidate/${candidateId}`);
  };

  const goToRecruiterProfile = (userId) => {
    if (!userId) return;
    router.push(`/recruiter/profile/${userId}`);
  };

  const findCandidateById = (candidateId) => {
    const numericId = Number(candidateId);
    if (!numericId) return null;
    return candidates.find((candidate) => candidate.id === numericId) || null;
  };

  const resolveInterviewCompany = (candidateId) => {
    const candidate = findCandidateById(candidateId);
    if (!candidate) return '';
    return (
      candidate.current_company ||
      candidate.company ||
      candidate.company_name ||
      (candidate.name ? `${candidate.name} Interview` : '')
    );
  };

  const formatDateTime = (value) => {
    if (!value) return '--';
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return value;
    }
  };

  const formatDate = (value) => {
    if (!value) return '--';
    try {
      return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
      return value;
    }
  };

  const formatLabel = (value) => {
    if (!value) return '--';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const handleFormChange = (field) => (event) => {
    const { type, checked, value } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFormValues((prev) => {
      if (field === 'candidateId') {
        const updated = { ...prev, candidateId: nextValue };

        if (prev.includeInterview) {
          const autoCompany = resolveInterviewCompany(nextValue);
          const previousAutoCompany = resolveInterviewCompany(prev.candidateId);
          if (!prev.interviewCompany || prev.interviewCompany === previousAutoCompany) {
            updated.interviewCompany = autoCompany || prev.interviewCompany;
          }
        }

        return updated;
      }

      if (field === 'includeInterview') {
        if (nextValue) {
          return {
            ...prev,
            includeInterview: true,
            interviewCompany: prev.interviewCompany || resolveInterviewCompany(prev.candidateId),
            interviewType: prev.interviewType || 'phone',
            interviewRound: prev.interviewRound || '1',
            interviewTimezone: prev.interviewTimezone || 'UTC',
          };
        }

        return {
          ...prev,
          includeInterview: false,
          interviewCompany: '',
          interviewDate: '',
          interviewType: 'phone',
          interviewRound: '1',
          interviewNotes: '',
        };
      }

      if (field === 'includeAssessment') {
        if (nextValue) {
          return {
            ...prev,
            includeAssessment: true,
            assessmentPlatform: prev.assessmentPlatform,
            assessmentType: prev.assessmentType || 'technical',
          };
        }

        return {
          ...prev,
          includeAssessment: false,
          assessmentPlatform: '',
          assessmentType: 'technical',
          assessmentDueDate: '',
          assessmentNotes: '',
        };
      }

      return { ...prev, [field]: nextValue };
    });

    if (formMessage) setFormMessage(null);
  };

  const handlePresetCount = (count) => {
    setFormValues((prev) => ({ ...prev, applicationsCount: count }));
    if (formMessage) setFormMessage(null);
  };

  const resetForm = () => {
    const defaults = createDefaultFormValues();
    if (typeof Intl !== 'undefined') {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) {
        defaults.interviewTimezone = timezone;
      }
    }
    setFormValues(defaults);
    setFormMessage(null);
  };

  const handleStartEdit = (application) => {
    if (updateApplication.isPending) return;
    setEditingApplicationId(application.id);
    setEditingApplicationsCount(String(application.applications_count ?? 0));
    setEditMessage(null);
  };

  const handleCancelEdit = () => {
    if (updateApplication.isPending) return;
    setEditingApplicationId(null);
    setEditingApplicationsCount('');
    setEditMessage(null);
  };

  const handleApproveApplication = (application) => {
    if (!token || approveApplication.isPending) return;
    setEditMessage(null);
    approveApplication.mutate({ applicationId: application.id, approved: true });
  };

  const handleRejectApplication = (application) => {
    if (!token || deleteApplication.isPending) return;
    setEditMessage(null);
    deleteApplication.mutate(application.id);
  };

  const handleSaveEdit = (applicationId) => {
    if (!token || !applicationId || updateApplication.isPending) {
      return;
    }

    if (editingApplicationsCount === '') {
      setEditMessage({ type: 'error', text: 'Enter a count before saving.' });
      return;
    }

    const parsedCount = Number(editingApplicationsCount);
    if (!Number.isInteger(parsedCount) || parsedCount < 0) {
      setEditMessage({ type: 'error', text: 'Applications count must be a non-negative integer.' });
      return;
    }

    setEditMessage(null);
    updateApplication.mutate({
      applicationId,
      payload: { applications_count: parsedCount },
    });
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

    const includeInterview = Boolean(formValues.includeInterview);
    const includeAssessment = Boolean(formValues.includeAssessment);

    const trimmedInterviewCompany = formValues.interviewCompany?.trim() || '';
    const interviewRoundNumber = Number(formValues.interviewRound || 1);
    const interviewTimezone = formValues.interviewTimezone?.trim() || 'UTC';
    const trimmedAssessmentPlatform = formValues.assessmentPlatform?.trim() || '';
    const assessmentType = formValues.assessmentType || 'technical';

    if (includeInterview) {
      if (!trimmedInterviewCompany) {
        setFormMessage({
          type: 'error',
          text: 'Please add the interview company before logging.',
        });
        return;
      }

      if (!formValues.interviewDate) {
        setFormMessage({
          type: 'error',
          text: 'Please provide the interview date and time before logging.',
        });
        return;
      }

      if (!Number.isFinite(interviewRoundNumber) || interviewRoundNumber < 1) {
        setFormMessage({
          type: 'error',
          text: 'Interview round must be a positive number.',
        });
        return;
      }
    }

    if (includeAssessment) {
      if (!formValues.assessmentDueDate) {
        setFormMessage({
          type: 'error',
          text: 'Please provide the assessment due date before logging.',
        });
        return;
      }

      if (!assessmentType) {
        setFormMessage({
          type: 'error',
          text: 'Select an assessment type before logging.',
        });
        return;
      }
    }

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

    const interviewPayload = includeInterview
      ? {
          candidate_id: Number(formValues.candidateId),
          company_name: trimmedInterviewCompany || `${candidateLabel} Interview`,
          scheduled_date: formValues.interviewDate
            ? new Date(formValues.interviewDate).toISOString()
            : null,
          interview_type: formValues.interviewType || 'phone',
          round_number: Number.isFinite(interviewRoundNumber) && interviewRoundNumber > 0
            ? interviewRoundNumber
            : 1,
          timezone: interviewTimezone || 'UTC',
          status: 'scheduled',
          notes: formValues.interviewNotes?.trim() || undefined,
        }
      : null;

    const assessmentPayload = includeAssessment
      ? {
          candidate_id: Number(formValues.candidateId),
          assessment_platform: trimmedAssessmentPlatform || 'General',
          assessment_type: assessmentType,
          due_date: formValues.assessmentDueDate
            ? new Date(formValues.assessmentDueDate).toISOString()
            : null,
          status: 'assigned',
          notes: formValues.assessmentNotes?.trim() || undefined,
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

              <div className="md:col-span-2 space-y-3 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={formValues.includeInterview}
                    onChange={handleFormChange('includeInterview')}
                    className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                  />
                  Log interview details
                </label>
                {formValues.includeInterview && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Interview company</label>
                      <Input
                        value={formValues.interviewCompany}
                        onChange={handleFormChange('interviewCompany')}
                        placeholder="e.g., Acme Corp."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Round</label>
                      <Input
                        type="number"
                        min={1}
                        value={formValues.interviewRound}
                        onChange={handleFormChange('interviewRound')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Timezone</label>
                      <Input
                        value={formValues.interviewTimezone}
                        onChange={handleFormChange('interviewTimezone')}
                        placeholder="e.g., America/Chicago"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Interview date & time</label>
                      <Input
                        type="datetime-local"
                        value={formValues.interviewDate}
                        onChange={handleFormChange('interviewDate')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Interview type</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={formValues.interviewType}
                        onChange={handleFormChange('interviewType')}
                      >
                        <option value="phone">Phone</option>
                        <option value="video">Video</option>
                        <option value="onsite">On-site</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <label className="text-sm font-medium text-foreground">Interview notes (optional)</label>
                      <Textarea
                        value={formValues.interviewNotes}
                        onChange={handleFormChange('interviewNotes')}
                        rows={2}
                        placeholder="Share context or prep notes..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 space-y-3 border-t border-border pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={formValues.includeAssessment}
                    onChange={handleFormChange('includeAssessment')}
                    className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                  />
                  Log assessment details
                </label>
                {formValues.includeAssessment && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Assessment platform</label>
                      <Input
                        value={formValues.assessmentPlatform}
                        onChange={handleFormChange('assessmentPlatform')}
                        placeholder="e.g., HackerRank, Codility"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Assessment type</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={formValues.assessmentType}
                        onChange={handleFormChange('assessmentType')}
                      >
                        <option value="technical">Technical</option>
                        <option value="coding">Coding</option>
                        <option value="behavioral">Behavioral</option>
                        <option value="take_home">Take-home</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Due date</label>
                      <Input
                        type="datetime-local"
                        value={formValues.assessmentDueDate}
                        onChange={handleFormChange('assessmentDueDate')}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <label className="text-sm font-medium text-foreground">Assessment notes (optional)</label>
                      <Textarea
                        value={formValues.assessmentNotes}
                        onChange={handleFormChange('assessmentNotes')}
                        rows={2}
                        placeholder="Share expectations or follow-up steps..."
                      />
                    </div>
                  </div>
                )}
              </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Filtered Records" value={filteredApplications.length} />
            <SummaryCard label="Approved Total (Filtered)" value={filteredApprovalSummary.approved} />
            <SummaryCard label="Pending Total (Filtered)" value={filteredApprovalSummary.pending} />
            <SummaryCard label="Pending Records" value={filteredApprovalSummary.pendingRecords} />
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Upcoming Interviews</h3>
                <p className="text-sm text-muted-foreground">
                  Keep track of scheduled conversations so nothing slips through.
                </p>
              </div>
              {interviews.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(interviews.length, 5)} of {interviews.length}
                </span>
              )}
            </div>
            {interviewsLoading || interviewsRefetching ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading interviews...
              </div>
            ) : interviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No upcoming interviews logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {interviews.slice(0, 5).map((interview) => (
                  <div
                    key={interview.id}
                    className="rounded-md border border-border bg-card/70 p-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {interview.candidate_name || 'Candidate'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {interview.company_name || 'Company not set'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        {formatDateTime(interview.scheduled_date)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatLabel(interview.interview_type)}</span>
                      <span>Round {interview.round_number || 1}</span>
                      <span>{interview.timezone || 'UTC'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToCandidate(interview.candidate_id)}
                        className="text-xs"
                      >
                        View candidate
                      </Button>
                    </div>
                    {interview.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {interview.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Pending Assessments</h3>
                <p className="text-sm text-muted-foreground">
                  Track assessments awaiting completion or review.
                </p>
              </div>
              {assessments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(assessments.length, 5)} of {assessments.length}
                </span>
              )}
            </div>
            {assessmentsLoading || assessmentsRefetching ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading assessments...
              </div>
            ) : assessments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No pending assessments logged yet.
              </div>
            ) : (
              <div className="space-y-3">
                {assessments.slice(0, 5).map((assessment) => (
                  <div
                    key={assessment.id}
                    className="rounded-md border border-border bg-card/70 p-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {assessment.candidate_name || 'Candidate'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assessment.assessment_platform || 'Platform not set'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        Due {formatDate(assessment.due_date)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatLabel(assessment.assessment_type)}</span>
                      <span>{formatLabel(assessment.status)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToCandidate(assessment.candidate_id)}
                        className="text-xs"
                      >
                        View candidate
                      </Button>
                    </div>
                    {assessment.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {assessment.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="overflow-hidden">
          {applicationsLoading || candidatesLoading || applicationsRefetching ? (
            <div className="p-6 text-center text-muted-foreground">Loading applications...</div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No applications found. Adjust filters or add a new submission.
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {editMessage && (
                <div
                  className={`rounded-md border px-4 py-2 text-sm ${
                    editMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {editMessage.text}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Candidate</th>
                    <th className="px-4 py-3 text-left font-medium">Recruiter</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Job Title</th>
                    <th className="px-4 py-3 text-left font-medium">Channel</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Applied On</th>
                    <th className="px-4 py-3 text-right font-medium">Count</th>
                    <th className="px-4 py-3 text-left font-medium">Approval</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((application) => {
                    const isEditing = editingApplicationId === application.id;
                    const normalizedDate = application.application_date
                      ? new Date(application.application_date).toISOString().split('T')[0]
                      : null;
                    const isApproved = Boolean(application.is_approved);
                    const canEdit =
                      userRole === 'Admin' ||
                      (!isApproved && (normalizedDate ? normalizedDate === today : true));
                    const approvalUpdating =
                      approveApplication.isPending &&
                      approveApplication.variables?.applicationId === application.id;
                    const rowClasses = `border-b border-border transition ${
                      isEditing ? 'bg-muted/30' : 'hover:bg-accent/60 cursor-pointer'
                    } ${isApproved ? '' : 'border-l-4 border-l-amber-400'}`;

                    return (
                      <tr
                        key={application.id}
                        className={rowClasses}
                        onClick={
                          !isEditing ? () => goToCandidate(application.candidate_id) : undefined
                        }
                      >
                        <td className="px-4 py-3 text-foreground">
                          {application.candidate_id ? (
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                goToCandidate(application.candidate_id);
                              }}
                            >
                              {application.candidate_name || 'View candidate'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {application.recruiter_id ? (
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                goToRecruiterProfile(application.recruiter_id);
                              }}
                            >
                              {application.recruiter_name || 'Recruiter'}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">{application.company_name || '--'}</td>
                        <td className="px-4 py-3 text-foreground">{application.job_title || '--'}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{application.channel || '--'}</td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{application.status || '--'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {application.application_date
                            ? new Date(application.application_date).toLocaleDateString()
                            : '--'}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground font-medium">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              value={editingApplicationsCount}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                setEditingApplicationsCount(event.target.value);
                                if (editMessage) setEditMessage(null);
                              }}
                              className="w-24 ml-auto"
                            />
                          ) : (
                            application.applications_count || 0
                          )}
                        </td>
                        <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isApproved
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }
                      >
                        {isApproved ? 'Approved' : 'Pending'}
                      </Badge>
                      {userRole === 'Admin' && (
                        <>
                          <Button
                            type="button"
                            size="xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleApproveApplication(application);
                            }}
                            disabled={approvalUpdating || isApproved}
                          >
                            {approvalUpdating ? 'Updating...' : 'Approve'}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRejectApplication(application);
                            }}
                            disabled={deleteApplication.isPending}
                          >
                            {deleteApplication.isPending ? 'Deleting...' : 'Reject'}
                          </Button>
                        </>
                      )}
                    </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCancelEdit();
                                }}
                                disabled={updateApplication.isPending}
                              >
                                <X size={14} />
                                <span className="sr-only">Cancel</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleSaveEdit(application.id);
                                }}
                                disabled={updateApplication.isPending}
                              >
                                {updateApplication.isPending ? (
                                  'Saving...'
                                ) : (
                                  <>
                                    <Check size={14} className="mr-1" />
                                    Save
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : canEdit ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleStartEdit(application);
                              }}
                              disabled={Boolean(editingApplicationId)}
                            >
                              <Edit size={14} className="mr-1" />
                              Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {isApproved ? 'Locked (approved)' : 'Locked'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
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







