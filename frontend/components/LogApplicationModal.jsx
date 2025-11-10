import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import Textarea from './ui/textarea';
import {
  useCandidatesQuery,
  useLogApplicationMutation,
} from '../lib/queryHooks';
import API_URL from '../lib/api';
import { track } from '../lib/analytics';

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

const LogApplicationModal = ({ token, onApplicationLogged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formValues, setFormValues] = useState(createDefaultFormValues);
  const [formMessage, setFormMessage] = useState(null);

  const { data: candidates = [], isLoading: candidatesLoading } =
    useCandidatesQuery(token);

  const logApplication = useLogApplicationMutation(token, {
    onSuccess: () => {
      setFormMessage({ type: 'success', text: 'Application logged successfully.' });
      resetForm();
      onApplicationLogged();
      setIsOpen(false); // Close modal on success
    },
    onError: (error) => {
      setFormMessage({ type: 'error', text: error.message || 'Unable to log application.' });
    },
  });

  const needsReductionReason = Number(formValues.applicationsCount || 0) < 60;

  useEffect(() => {
    if (!needsReductionReason && formValues.reductionReason) {
      setFormValues((prev) => ({ ...prev, reductionReason: '' }));
    }
  }, [needsReductionReason, formValues.reductionReason]);

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
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    setFormMessage(null);
    if (currentStep === 1) {
      if (!formValues.candidateId) {
        setFormMessage({ type: 'error', text: 'Please select a candidate.' });
        return;
      }
      if (Number(formValues.applicationsCount) < 60 && !formValues.reductionReason.trim()) {
        setFormMessage({ type: 'error', text: 'Please provide a reason for fewer than 60 applications.' });
        return;
      }
    } else if (currentStep === 2 && formValues.includeInterview) {
      const trimmedInterviewCompany = formValues.interviewCompany?.trim() || '';
      const interviewRoundNumber = Number(formValues.interviewRound || 1);

      if (!trimmedInterviewCompany) {
        setFormMessage({ type: 'error', text: 'Please add the interview company.' });
        return;
      }
      if (!formValues.interviewDate) {
        setFormMessage({ type: 'error', text: 'Please provide the interview date and time.' });
        return;
      }
      if (!Number.isFinite(interviewRoundNumber) || interviewRoundNumber < 1) {
        setFormMessage({ type: 'error', text: 'Interview round must be a positive number.' });
        return;
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setFormMessage(null);
    setCurrentStep((prev) => prev - 1);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => { setIsOpen(true); resetForm(); }}>Log New Application</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Log New Application</DialogTitle>
          <DialogDescription>
            Log today&apos;s outreach volume. Target is 60 applications&mdash;add a quick note if you logged fewer.
          </DialogDescription>
        </DialogHeader>

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

        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step 1: Basic Details</h3>
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
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step 2: Interview Details (Optional)</h3>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={formValues.includeInterview}
                  onChange={handleFormChange('includeInterview')}
                  className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                />
                Include Interview Details
              </label>
              {formValues.includeInterview && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2 md:col-span-2">
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
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Step 3: Assessment Details (Optional)</h3>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={formValues.includeAssessment}
                  onChange={handleFormChange('includeAssessment')}
                  className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                />
                Include Assessment Details
              </label>
              {formValues.includeAssessment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="space-y-2 md:col-span-2">
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
          )}

          <div className="flex justify-between pt-4">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevStep}>
                Previous
              </Button>
            )}
            {currentStep < 3 && (
              <Button type="button" onClick={handleNextStep} className="ml-auto">
                Next
              </Button>
            )}
            {currentStep === 3 && (
              <Button type="submit" disabled={logApplication.isPending} className="ml-auto">
                {logApplication.isPending ? 'Logging...' : 'Log Application'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LogApplicationModal;


