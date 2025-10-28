import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  User,
  Users,
  Briefcase,
  Target,
  TrendingUp,
  Edit,
  Home,
  FileText,
  AlertTriangle,
  MessageSquare,
  Lock,
  Bell,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import Textarea from '../../../components/ui/textarea';
import DashboardLayout from '../../../components/Layout/DashboardLayout';
import API_URL from '../../../lib/api';
import {
  queryKeys,
  useCandidatesQuery,
  useCandidateNotesQuery,
  useCreateCandidateNoteMutation,
  useUpdateCandidateNoteMutation,
  useDeleteCandidateNoteMutation,
  useInterviewsQuery,
  useAssessmentsQuery,
  useCreateInterviewMutation,
  useCreateAssessmentMutation,
  useUpdateInterviewMutation,
  useUpdateAssessmentMutation,
  useApproveInterviewMutation,
  useApproveAssessmentMutation,
} from '../../../lib/queryHooks';

const sidebarLinks = [
  { href: '/recruiter', label: 'Dashboard', icon: Home },
  { href: '/recruiter/candidates', label: 'Candidates', icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
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

const INTERVIEW_STATUSES = ['scheduled', 'completed', 'feedback_pending', 'advanced', 'rejected'];
const ASSESSMENT_STATUSES = ['assigned', 'submitted', 'passed', 'failed', 'waived'];

const CandidateDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);
  const [noteFollowUpEnabled, setNoteFollowUpEnabled] = useState(false);
  const [noteFollowUpDueDate, setNoteFollowUpDueDate] = useState('');
  const [noteFollowUpTitle, setNoteFollowUpTitle] = useState('');
  const [noteFollowUpDescription, setNoteFollowUpDescription] = useState('');
  const [noteFollowUpPriority, setNoteFollowUpPriority] = useState(1);
  const [noteMessage, setNoteMessage] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [defaultTimezone, setDefaultTimezone] = useState('UTC');
  const [interviewFormOpen, setInterviewFormOpen] = useState(false);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    company: '',
    date: '',
    type: 'phone',
    round: '1',
    timezone: 'UTC',
    notes: '',
  });
  const [assessmentForm, setAssessmentForm] = useState({
    platform: '',
    type: 'technical',
    dueDate: '',
    notes: '',
  });
  const [interviewMessage, setInterviewMessage] = useState(null);
  const [assessmentMessage, setAssessmentMessage] = useState(null);
  const [interviewStatusDrafts, setInterviewStatusDrafts] = useState({});
  const [assessmentStatusDrafts, setAssessmentStatusDrafts] = useState({});
  const [assessmentScoreDrafts, setAssessmentScoreDrafts] = useState({});
  const [interviewTimelineMessage, setInterviewTimelineMessage] = useState(null);
  const [assessmentTimelineMessage, setAssessmentTimelineMessage] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    const storedRole = localStorage.getItem('userRole');
    if (storedRole) {
      setCurrentUserRole(storedRole);
    }
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      const parsedId = parseInt(storedUserId, 10);
      setCurrentUserId(Number.isNaN(parsedId) ? null : parsedId);
    }
  }, [router]);

  useEffect(() => {
    if (typeof Intl === 'undefined') return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      setDefaultTimezone(timezone);
      setInterviewForm((prev) => ({
        ...prev,
        timezone: prev.timezone && prev.timezone !== 'UTC' ? prev.timezone : timezone,
      }));
    }
  }, []);

  const candidateId = useMemo(() => {
    if (!id) return null;
    const numericId = Array.isArray(id) ? parseInt(id[0], 10) : parseInt(id, 10);
    return Number.isNaN(numericId) ? null : numericId;
  }, [id]);

  const { data: candidates = [], isLoading: candidatesLoading } = useCandidatesQuery(token, Boolean(token));

  const candidate = useMemo(
    () => candidates.find((c) => c.id === candidateId),
    [candidates, candidateId]
  );

  const defaultInterviewCompany = useMemo(() => {
    if (!candidate) return '';
    return (
      candidate.current_company ||
      candidate.company ||
      candidate.company_name ||
      (candidate.name ? `${candidate.name} Interview` : '')
    );
  }, [candidate]);

  useEffect(() => {
    if (!defaultInterviewCompany) return;
    setInterviewForm((prev) => ({
      ...prev,
      company: prev.company || defaultInterviewCompany,
    }));
  }, [defaultInterviewCompany]);

  const {
    data: notes = [],
    isLoading: notesLoading,
  } = useCandidateNotesQuery(token, candidateId, Boolean(token && candidateId));

  const {
    data: candidateInterviews = [],
    isLoading: candidateInterviewsLoading,
    isRefetching: candidateInterviewsRefetching,
  } = useInterviewsQuery(token, { candidate_id: candidateId }, Boolean(token && candidateId));

  const {
    data: candidateAssessments = [],
    isLoading: candidateAssessmentsLoading,
    isRefetching: candidateAssessmentsRefetching,
  } = useAssessmentsQuery(token, { candidate_id: candidateId }, Boolean(token && candidateId));

  const resetInterviewForm = useCallback(() => {
    setInterviewForm({
      company: defaultInterviewCompany || '',
      date: '',
      type: 'phone',
      round: '1',
      timezone: defaultTimezone || 'UTC',
      notes: '',
    });
  }, [defaultInterviewCompany, defaultTimezone]);

  const resetAssessmentForm = useCallback(() => {
    setAssessmentForm({
      platform: '',
      type: 'technical',
      dueDate: '',
      notes: '',
    });
  }, []);

  const createInterview = useCreateInterviewMutation(token, {
    onSuccess: () => {
      setInterviewMessage({ type: 'success', text: 'Interview logged successfully.' });
      resetInterviewForm();
    },
    onError: (mutationError) => {
      setInterviewMessage({ type: 'error', text: mutationError.message || 'Unable to log interview.' });
    },
  });

const createAssessment = useCreateAssessmentMutation(token, {
  onSuccess: () => {
    setAssessmentMessage({ type: 'success', text: 'Assessment logged successfully.' });
    resetAssessmentForm();
  },
  onError: (mutationError) => {
    setAssessmentMessage({ type: 'error', text: mutationError.message || 'Unable to log assessment.' });
  },
});

  const updateInterview = useUpdateInterviewMutation(token);
  const updateAssessment = useUpdateAssessmentMutation(token);
  const approveInterview = useApproveInterviewMutation(token, {
    onSuccess: () =>
      setInterviewTimelineMessage({ type: 'success', text: 'Interview approval updated.' }),
    onError: (error) =>
      setInterviewTimelineMessage({
        type: 'error',
        text: error.message || 'Unable to update interview approval.',
      }),
  });
  const approveAssessment = useApproveAssessmentMutation(token, {
    onSuccess: () =>
      setAssessmentTimelineMessage({ type: 'success', text: 'Assessment approval updated.' }),
    onError: (error) =>
      setAssessmentTimelineMessage({
        type: 'error',
        text: error.message || 'Unable to update assessment approval.',
      }),
  });

  const handleInterviewFieldChange = (field) => (event) => {
    const { value } = event.target;
    setInterviewForm((prev) => ({ ...prev, [field]: value }));
    if (interviewMessage) setInterviewMessage(null);
  };

  const handleAssessmentFieldChange = (field) => (event) => {
    const { value } = event.target;
    setAssessmentForm((prev) => ({ ...prev, [field]: value }));
    if (assessmentMessage) setAssessmentMessage(null);
  };

  const handleInterviewToggle = () => {
    if (interviewFormOpen) {
      resetInterviewForm();
      setInterviewMessage(null);
      setInterviewFormOpen(false);
      return;
    }
    if (!interviewForm.company && defaultInterviewCompany) {
      setInterviewForm((prev) => ({ ...prev, company: defaultInterviewCompany }));
    }
    setInterviewMessage(null);
    setInterviewFormOpen(true);
  };

  const handleAssessmentToggle = () => {
    if (assessmentFormOpen) {
      resetAssessmentForm();
      setAssessmentMessage(null);
      setAssessmentFormOpen(false);
      return;
    }
    setAssessmentMessage(null);
    setAssessmentFormOpen(true);
  };

  const handleInterviewSubmit = (event) => {
    event.preventDefault();
    if (!candidateId) {
      setInterviewMessage({ type: 'error', text: 'Missing candidate context. Please reload and try again.' });
      return;
    }
    if (createInterview.isPending) return;

    const trimmedCompany = (interviewForm.company || '').trim();
    if (!trimmedCompany) {
      setInterviewMessage({ type: 'error', text: 'Please add the interview company before saving.' });
      return;
    }

    if (!interviewForm.date) {
      setInterviewMessage({ type: 'error', text: 'Please provide the interview date and time.' });
      return;
    }

    const scheduledDate = new Date(interviewForm.date);
    if (Number.isNaN(scheduledDate.getTime())) {
      setInterviewMessage({ type: 'error', text: 'Interview date is invalid. Please adjust and try again.' });
      return;
    }

    const roundNumber = parseInt(interviewForm.round, 10);
    if (!Number.isFinite(roundNumber) || roundNumber < 1) {
      setInterviewMessage({ type: 'error', text: 'Interview round must be a positive number.' });
      return;
    }

    const timezoneValue = (interviewForm.timezone || '').trim() || defaultTimezone || 'UTC';
    const trimmedNotes = (interviewForm.notes || '').trim();

    createInterview.mutate({
      candidate_id: candidateId,
      application_id: null,
      company_name: trimmedCompany,
      interview_type: interviewForm.type || 'phone',
      round_number: roundNumber,
      scheduled_date: scheduledDate.toISOString(),
      timezone: timezoneValue,
      status: 'scheduled',
      notes: trimmedNotes || undefined,
    });
  };

  const handleAssessmentSubmit = (event) => {
    event.preventDefault();
    if (!candidateId) {
      setAssessmentMessage({ type: 'error', text: 'Missing candidate context. Please reload and try again.' });
      return;
    }
    if (createAssessment.isPending) return;

    const trimmedPlatform = (assessmentForm.platform || '').trim();
    if (!trimmedPlatform) {
      setAssessmentMessage({ type: 'error', text: 'Please add the assessment platform before saving.' });
      return;
    }

    if (!assessmentForm.dueDate) {
      setAssessmentMessage({ type: 'error', text: 'Please provide the assessment due date.' });
      return;
    }

    const dueDate = new Date(assessmentForm.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      setAssessmentMessage({ type: 'error', text: 'Assessment due date is invalid. Please adjust and try again.' });
      return;
    }

    const trimmedAssessmentNotes = (assessmentForm.notes || '').trim();

    createAssessment.mutate({
      candidate_id: candidateId,
      application_id: null,
      assessment_platform: trimmedPlatform,
      assessment_type: assessmentForm.type || 'technical',
      due_date: dueDate.toISOString(),
      status: 'assigned',
      notes: trimmedAssessmentNotes || undefined,
    });
  };

  const handleInterviewStatusChange = (interviewId, nextValue) => {
    setInterviewStatusDrafts((prev) => ({ ...prev, [interviewId]: nextValue }));
    setInterviewTimelineMessage(null);
  };

  const handleAssessmentStatusChange = (assessmentId, nextValue) => {
    setAssessmentStatusDrafts((prev) => ({ ...prev, [assessmentId]: nextValue }));
    setAssessmentTimelineMessage(null);
  };

  const handleAssessmentScoreChange = (assessmentId, value) => {
    setAssessmentScoreDrafts((prev) => ({ ...prev, [assessmentId]: value }));
    setAssessmentTimelineMessage(null);
  };

  const handleInterviewStatusSave = (interview) => {
    const draftStatus = interviewStatusDrafts[interview.id];

    if (interview.is_approved && currentUserRole !== 'Admin') {
      setInterviewTimelineMessage({
        type: 'error',
        text: 'Approved interviews are locked. Contact an admin to update.',
      });
      return;
    }

    const payload = {};

    if (draftStatus !== undefined && draftStatus !== interview.status) {
      payload.status = draftStatus;
    }

    if (Object.keys(payload).length === 0) {
      setInterviewTimelineMessage({
        type: 'info',
        text: 'No interview changes to save.',
      });
      return;
    }

    setInterviewTimelineMessage(null);

    updateInterview.mutate(
      { interviewId: interview.id, payload },
      {
        onSuccess: () => {
          setInterviewTimelineMessage({ type: 'success', text: 'Interview updated.' });
          setInterviewStatusDrafts((prev) => {
            const { [interview.id]: _discard, ...rest } = prev;
            return rest;
          });
        },
        onError: (error) => {
          setInterviewTimelineMessage({
            type: 'error',
            text: error.message || 'Unable to update interview.',
          });
        },
      },
    );
  };

  const handleInterviewApprovalToggle = (interview, approved) => {
    setInterviewTimelineMessage(null);
    approveInterview.mutate({ interviewId: interview.id, approved });
  };

  const handleAssessmentApprovalToggle = (assessment, approved) => {
    setAssessmentTimelineMessage(null);
    approveAssessment.mutate({ assessmentId: assessment.id, approved });
  };

  const handleAssessmentUpdate = (assessment) => {
    const draftStatus = assessmentStatusDrafts[assessment.id];
    const draftScoreRaw = assessmentScoreDrafts[assessment.id];

    if (assessment.is_approved && currentUserRole !== 'Admin') {
      setAssessmentTimelineMessage({
        type: 'error',
        text: 'Approved assessments are locked. Contact an admin to update.',
      });
      return;
    }

    const payload = {};

    if (draftStatus !== undefined && draftStatus !== assessment.status) {
      payload.status = draftStatus;
    }

    if (draftScoreRaw !== undefined) {
      const cleaned = draftScoreRaw === '' ? null : Number(draftScoreRaw);
      if (cleaned !== null && !Number.isFinite(cleaned)) {
        setAssessmentTimelineMessage({
          type: 'error',
          text: 'Score must be a number.',
        });
        return;
      }
      payload.score = cleaned;
    }

    if (Object.keys(payload).length === 0) {
      setAssessmentTimelineMessage({
        type: 'info',
        text: 'No assessment changes to save.',
      });
      return;
    }

    setAssessmentTimelineMessage(null);

    updateAssessment.mutate(
      { assessmentId: assessment.id, payload },
      {
        onSuccess: () => {
          setAssessmentTimelineMessage({ type: 'success', text: 'Assessment updated.' });
          setAssessmentStatusDrafts((prev) => {
            const { [assessment.id]: _discard, ...rest } = prev;
            return rest;
          });
          setAssessmentScoreDrafts((prev) => {
            const { [assessment.id]: _discard, ...rest } = prev;
            return rest;
          });
        },
        onError: (error) => {
          setAssessmentTimelineMessage({
            type: 'error',
            text: error.message || 'Unable to update assessment.',
          });
        },
      },
    );
  };

  const resetNoteForm = (clearMessage = false) => {
    setEditingNoteId(null);
    setNoteContent('');
    setNoteIsPrivate(false);
    setNoteFollowUpEnabled(false);
    setNoteFollowUpDueDate('');
    setNoteFollowUpTitle('');
    setNoteFollowUpDescription('');
    setNoteFollowUpPriority(1);
    if (clearMessage) {
      setNoteMessage(null);
    }
  };

  const createNote = useCreateCandidateNoteMutation(token, candidateId, {
    onSuccess: () => {
      setNoteMessage({ type: 'success', text: 'Note added successfully.' });
      resetNoteForm();
    },
    onError: (mutationError) => {
      setNoteMessage({ type: 'error', text: mutationError.message || 'Unable to add note.' });
    },
  });

  const updateNote = useUpdateCandidateNoteMutation(token, candidateId, {
    onSuccess: () => {
      setNoteMessage({ type: 'success', text: 'Note updated successfully.' });
      resetNoteForm();
    },
    onError: (mutationError) => {
      setNoteMessage({ type: 'error', text: mutationError.message || 'Unable to update note.' });
    },
  });

  const deleteNote = useDeleteCandidateNoteMutation(token, candidateId, {
    onSuccess: () => {
      setNoteMessage({ type: 'success', text: 'Note deleted successfully.' });
      resetNoteForm();
    },
    onError: (mutationError) => {
      setNoteMessage({ type: 'error', text: mutationError.message || 'Unable to delete note.' });
    },
  });

  const noteActionsDisabled = updateNote.isPending || deleteNote.isPending;

  const handleNoteSubmit = (event) => {
    event.preventDefault();
    if (!candidateId || !noteContent.trim()) {
      setNoteMessage({ type: 'error', text: 'Please enter a note before saving.' });
      return;
    }

    const payload = {
      content: noteContent.trim(),
      isPrivate: noteIsPrivate,
    };

    if (noteFollowUpEnabled && noteFollowUpDueDate) {
      payload.followUp = {
        dueDate: noteFollowUpDueDate,
        title: noteFollowUpTitle,
        description: noteFollowUpDescription,
        priority: noteFollowUpPriority,
      };
    }

    if (editingNoteId) {
      updateNote.mutate({ noteId: editingNoteId, payload });
    } else {
      createNote.mutate(payload);
    }
  };

  const toDateTimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset();
    const localISO = new Date(date.getTime() - tzOffset * 60000).toISOString().slice(0, 16);
    return localISO;
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNoteContent(note.content || '');
    setNoteIsPrivate(Boolean(note.isPrivate));
    if (note.reminder) {
      setNoteFollowUpEnabled(true);
      setNoteFollowUpDueDate(toDateTimeLocal(note.reminder.dueDate));
      setNoteFollowUpTitle(note.reminder.title || '');
      setNoteFollowUpDescription(note.reminder.description || '');
      setNoteFollowUpPriority(note.reminder.priority || 1);
    } else {
      setNoteFollowUpEnabled(false);
      setNoteFollowUpDueDate('');
      setNoteFollowUpTitle('');
      setNoteFollowUpDescription('');
      setNoteFollowUpPriority(1);
    }
    if (noteMessage) {
      setNoteMessage(null);
    }
  };

  const handleDeleteNote = (noteId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this note?');
    if (!confirmDelete) return;
    deleteNote.mutate(noteId);
  };

  const formatDateTime = (value) => {
    if (!value) return 'Unknown time';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch (err) {
      return String(value);
    }
  };

  const formatDate = (value) => {
    if (!value) return '--';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(new Date(value));
    } catch (err) {
      return String(value);
    }
  };

  const formatLabel = (value) => {
    if (!value) return '--';
    return String(value)
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const stageLabel = useMemo(() => {
    if (!candidate?.current_stage) return 'N/A';
    return candidate.current_stage
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [candidate?.current_stage]);

  const primarySkill = useMemo(() => candidate?.skills?.[0] || 'N/A', [candidate?.skills]);

  const isLoadingCandidate = candidatesLoading || !token || (candidateId !== null && !candidate);

  if (isLoadingCandidate) {
    return (
      <DashboardLayout title="Candidate Detail" links={sidebarLinks} onBack={() => router.push('/recruiter')}>
        <div className="h-48 flex items-center justify-center text-muted-foreground">Loading candidate...</div>
      </DashboardLayout>
    );
  }

  if (!candidate && !isLoadingCandidate && candidateId !== null) {
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Candidate Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoTile icon={<User className="h-5 w-5 text-blue-600" />} label="Name" value={candidate.name} />
            <InfoTile
              icon={<Users className="h-5 w-5 text-emerald-600" />}
              label="Assigned Recruiter"
              value={
                candidate.assigned_recruiter_id ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => goToRecruiterProfile(candidate.assigned_recruiter_id)}
                  >
                    {candidate.recruiter_name || 'View recruiter'}
                  </button>
                ) : (
                  'Unassigned'
                )
              }
            />
            <InfoTile icon={<Briefcase className="h-5 w-5 text-emerald-600" />} label="Primary Skill" value={primarySkill} />
            <InfoTile icon={<Target className="h-5 w-5 text-purple-600" />} label="Daily Applications" value={candidate.daily_applications || 0} />
            <InfoTile icon={<FileText className="h-5 w-5 text-blue-600" />} label="Total Applications (All Time)" value={candidate.total_applications || 0} />
            <InfoTile icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Approved Applications (All Time)" value={candidate.approved_applications || 0} />
            <InfoTile icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} label="Pending Applications (All Time)" value={candidate.pending_applications || 0} />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Performance Snapshot</h3>
          <StatBadge label="Today's Applications" value={candidate.daily_applications || 0} tone="bg-blue-100 text-blue-700" />
          <StatBadge label="Approved Total" value={candidate.approved_applications || 0} tone="bg-emerald-100 text-emerald-700" />
          <StatBadge label="Pending Total" value={candidate.pending_applications || 0} tone="bg-amber-100 text-amber-700" />
          <StatBadge label="Overall Total" value={candidate.total_applications || 0} tone="bg-slate-100 text-slate-700" />
        </Card>
      </div>

      <Card className="p-6 space-y-6 mt-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pipeline Actions</h3>
          <p className="text-sm text-muted-foreground">
            Quickly log interviews and assessments without leaving the candidate profile.
          </p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-foreground">Interview</h4>
                <p className="text-xs text-muted-foreground">
                  Capture upcoming conversations or milestones tied to this candidate.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleInterviewToggle}>
                {interviewFormOpen ? 'Close' : 'Add'}
              </Button>
            </div>
            {interviewMessage && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  interviewMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {interviewMessage.text}
              </div>
            )}
            {interviewFormOpen && (
              <form onSubmit={handleInterviewSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="interview-company">Company</Label>
                  <Input
                    id="interview-company"
                    value={interviewForm.company}
                    onChange={handleInterviewFieldChange('company')}
                    placeholder="e.g., Acme Corp."
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="interview-round">Round</Label>
                    <Input
                      id="interview-round"
                      type="number"
                      min={1}
                      value={interviewForm.round}
                      onChange={handleInterviewFieldChange('round')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview-timezone">Timezone</Label>
                    <Input
                      id="interview-timezone"
                      value={interviewForm.timezone}
                      onChange={handleInterviewFieldChange('timezone')}
                      placeholder="e.g., America/Chicago"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="interview-datetime">Date &amp; time</Label>
                    <Input
                      id="interview-datetime"
                      type="datetime-local"
                      value={interviewForm.date}
                      onChange={handleInterviewFieldChange('date')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interview-type">Interview type</Label>
                    <select
                      id="interview-type"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={interviewForm.type}
                      onChange={handleInterviewFieldChange('type')}
                    >
                      <option value="phone">Phone</option>
                      <option value="video">Video</option>
                      <option value="onsite">On-site</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interview-notes">Notes (optional)</Label>
                  <Textarea
                    id="interview-notes"
                    value={interviewForm.notes}
                    onChange={handleInterviewFieldChange('notes')}
                    rows={2}
                    placeholder="Add prep notes or context..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetInterviewForm}
                    disabled={createInterview.isPending}
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={createInterview.isPending}>
                    {createInterview.isPending ? 'Saving...' : 'Save Interview'}
                  </Button>
                </div>
              </form>
            )}
          </div>
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-foreground">Assessment</h4>
                <p className="text-xs text-muted-foreground">
                  Assign or track assessments linked to this candidate.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAssessmentToggle}>
                {assessmentFormOpen ? 'Close' : 'Add'}
              </Button>
            </div>
            {assessmentMessage && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  assessmentMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {assessmentMessage.text}
              </div>
            )}
            {assessmentFormOpen && (
              <form onSubmit={handleAssessmentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assessment-platform">Platform</Label>
                  <Input
                    id="assessment-platform"
                    value={assessmentForm.platform}
                    onChange={handleAssessmentFieldChange('platform')}
                    placeholder="e.g., HackerRank, Codility"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="assessment-type">Assessment type</Label>
                    <select
                      id="assessment-type"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={assessmentForm.type}
                      onChange={handleAssessmentFieldChange('type')}
                    >
                      <option value="technical">Technical</option>
                      <option value="coding">Coding</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="take_home">Take-home</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assessment-due">Due date</Label>
                    <Input
                      id="assessment-due"
                      type="datetime-local"
                      value={assessmentForm.dueDate}
                      onChange={handleAssessmentFieldChange('dueDate')}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assessment-notes">Notes (optional)</Label>
                  <Textarea
                    id="assessment-notes"
                    value={assessmentForm.notes}
                    onChange={handleAssessmentFieldChange('notes')}
                    rows={2}
                    placeholder="Add expectations or follow-up details..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetAssessmentForm}
                    disabled={createAssessment.isPending}
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={createAssessment.isPending}>
                    {createAssessment.isPending ? 'Saving...' : 'Save Assessment'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Interview Timeline</h3>
            <p className="text-sm text-muted-foreground">
              Review recent and upcoming interviews attached to this candidate.
            </p>
          </div>
          {candidateInterviewsLoading || candidateInterviewsRefetching ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Loading interviews...
            </div>
          ) : candidateInterviews.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No interviews logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {interviewTimelineMessage && (
                <div
                  className={`rounded-md border px-3 py-2 text-xs ${
                    interviewTimelineMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : interviewTimelineMessage.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-border bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {interviewTimelineMessage.text}
                </div>
              )}
              {candidateInterviews.map((interview) => {
                const isInterviewApproved = Boolean(interview.is_approved);
                const canEditInterview = currentUserRole === 'Admin' || !isInterviewApproved;
                const interviewApprovalUpdating =
                  approveInterview.isPending &&
                  approveInterview.variables?.interviewId === interview.id;

                return (
                  <div key={interview.id} className="rounded-md border border-border bg-card/70 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {interview.company_name || 'Company not set'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLabel(interview.interview_type)} · Round {interview.round_number || 1}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            isInterviewApproved
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }
                        >
                          {isInterviewApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {currentUserRole === 'Admin' && (
                          <Button
                            type="button"
                            variant={isInterviewApproved ? 'outline' : 'default'}
                            size="xs"
                            onClick={() => handleInterviewApprovalToggle(interview, !isInterviewApproved)}
                            disabled={interviewApprovalUpdating}
                          >
                            {interviewApprovalUpdating ? 'Updating...' : isInterviewApproved ? 'Undo' : 'Approve'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(interview.scheduled_date)}</span>
                      <span>|</span>
                      <span>{interview.timezone || 'UTC'}</span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex flex-col text-xs text-muted-foreground">
                        <span className="mb-1 font-medium text-foreground">Status</span>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={interviewStatusDrafts[interview.id] ?? interview.status}
                          onChange={(event) => handleInterviewStatusChange(interview.id, event.target.value)}
                          disabled={!canEditInterview}
                        >
                          {INTERVIEW_STATUSES.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {formatLabel(statusOption)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {canEditInterview ? (
                        <Button
                          type="button"
                          size="sm"
                          className="self-start"
                          onClick={() => handleInterviewStatusSave(interview)}
                          disabled={updateInterview.isPending}
                        >
                          {updateInterview.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Locked (approved)</span>
                      )}
                    </div>
                    {interview.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">{interview.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Assessment Tracker</h3>
            <p className="text-sm text-muted-foreground">
              Monitor outstanding assessments and due dates.
            </p>
          </div>
          {candidateAssessmentsLoading || candidateAssessmentsRefetching ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Loading assessments...
            </div>
          ) : candidateAssessments.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No assessments logged yet.
            </div>
          ) : (
            <div className="space-y-3">
              {assessmentTimelineMessage && (
                <div
                  className={`rounded-md border px-3 py-2 text-xs ${
                    assessmentTimelineMessage.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : assessmentTimelineMessage.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-border bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {assessmentTimelineMessage.text}
                </div>
              )}
              {candidateAssessments.map((assessment) => {
                const isAssessmentApproved = Boolean(assessment.is_approved);
                const canEditAssessment = currentUserRole === 'Admin' || !isAssessmentApproved;
                const assessmentApprovalUpdating =
                  approveAssessment.isPending &&
                  approveAssessment.variables?.assessmentId === assessment.id;

                return (
                  <div key={assessment.id} className="rounded-md border border-border bg-card/70 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {assessment.assessment_platform || 'Platform not set'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLabel(assessment.assessment_type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            isAssessmentApproved
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }
                        >
                          {isAssessmentApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {currentUserRole === 'Admin' && (
                          <Button
                            type="button"
                            variant={isAssessmentApproved ? 'outline' : 'default'}
                            size="xs"
                            onClick={() => handleAssessmentApprovalToggle(assessment, !isAssessmentApproved)}
                            disabled={assessmentApprovalUpdating}
                          >
                            {assessmentApprovalUpdating ? 'Updating...' : isAssessmentApproved ? 'Undo' : 'Approve'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Due {formatDate(assessment.due_date)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <label className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">Status</span>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={assessmentStatusDrafts[assessment.id] ?? assessment.status}
                          onChange={(event) => handleAssessmentStatusChange(assessment.id, event.target.value)}
                          disabled={!canEditAssessment}
                        >
                          {ASSESSMENT_STATUSES.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {formatLabel(statusOption)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">Score (optional)</span>
                        <Input
                          value={
                            Object.prototype.hasOwnProperty.call(assessmentScoreDrafts, assessment.id)
                              ? assessmentScoreDrafts[assessment.id]
                              : assessment.score ?? ''
                          }
                          onChange={(event) => handleAssessmentScoreChange(assessment.id, event.target.value)}
                          placeholder="e.g., 85"
                          disabled={!canEditAssessment}
                        />
                      </label>
                      <div className="flex items-end">
                        {canEditAssessment ? (
                          <Button
                            type="button"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => handleAssessmentUpdate(assessment)}
                            disabled={updateAssessment.isPending}
                          >
                            {updateAssessment.isPending ? 'Saving...' : 'Save'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Locked (approved)</span>
                        )}
                      </div>
                    </div>
                    {assessment.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">{assessment.notes}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 space-y-5 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Collaboration Feed
            </h3>
            <p className="text-sm text-muted-foreground">
              Share updates, blockers, or context for teammates. Private notes are visible only to you and admins.
            </p>
          </div>
        </div>

        {noteMessage && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              noteMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {noteMessage.text}
          </div>
        )}

        <form onSubmit={handleNoteSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-content">Add a note</Label>
            <Textarea
              id="note-content"
              value={noteContent}
              onChange={(event) => {
                setNoteContent(event.target.value);
                if (noteMessage) setNoteMessage(null);
              }}
              placeholder="Share updates, coaching ideas, or candidate feedback..."
              minLength={3}
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                checked={noteIsPrivate}
                onChange={(event) => {
                  setNoteIsPrivate(event.target.checked);
                  if (noteMessage) setNoteMessage(null);
                }}
              />
              <span className="flex items-center gap-1">
                <Lock className="h-4 w-4" />
                Private to me
              </span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-input text-primary focus:ring-primary"
                checked={noteFollowUpEnabled}
                onChange={(event) => {
                  setNoteFollowUpEnabled(event.target.checked);
                  if (noteMessage) setNoteMessage(null);
                }}
              />
              <span className="flex items-center gap-1">
                <Bell className="h-4 w-4" />
                Create follow-up reminder
              </span>
            </label>
          </div>

          {noteFollowUpEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label htmlFor="follow-up-due">Due date</Label>
                <Input
                  id="follow-up-due"
                  type="datetime-local"
                  value={noteFollowUpDueDate}
                  onChange={(event) => {
                    setNoteFollowUpDueDate(event.target.value);
                    if (noteMessage) setNoteMessage(null);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow-up-priority">Priority</Label>
                <select
                  id="follow-up-priority"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={noteFollowUpPriority}
                  onChange={(event) => {
                    setNoteFollowUpPriority(parseInt(event.target.value, 10) || 1);
                    if (noteMessage) setNoteMessage(null);
                  }}
                >
                  {[1, 2, 3, 4, 5].map((priority) => (
                    <option key={priority} value={priority}>
                      Priority {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="follow-up-title">Reminder title (optional)</Label>
                <Input
                  id="follow-up-title"
                  value={noteFollowUpTitle}
                  onChange={(event) => {
                    setNoteFollowUpTitle(event.target.value);
                    if (noteMessage) setNoteMessage(null);
                  }}
                  placeholder="Follow up with candidate"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="follow-up-description">Reminder description (optional)</Label>
                <Textarea
                  id="follow-up-description"
                  value={noteFollowUpDescription}
                  onChange={(event) => {
                    setNoteFollowUpDescription(event.target.value);
                    if (noteMessage) setNoteMessage(null);
                  }}
                  placeholder="Add context for the reminder..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => resetNoteForm(true)}
              disabled={createNote.isPending || updateNote.isPending}
            >
              {editingNoteId ? 'Cancel' : 'Clear'}
            </Button>
            <Button
              type="submit"
              disabled={createNote.isPending || updateNote.isPending}
            >
              {editingNoteId
                ? updateNote.isPending
                  ? 'Updating...'
                  : 'Update Note'
                : createNote.isPending
                  ? 'Saving...'
                  : 'Add Note'}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          {notesLoading ? (
            <div className="text-sm text-muted-foreground">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No notes yet. Start capturing updates to keep everyone aligned.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => {
                const canModify = currentUserRole === 'Admin' || note.author?.id === currentUserId;
                return (
                  <NoteItem
                    key={note.id}
                    note={note}
                    formatDateTime={formatDateTime}
                    canEdit={canModify}
                    canDelete={canModify}
                    onEdit={() => handleEditNote(note)}
                    onDelete={() => handleDeleteNote(note.id)}
                    isEditing={editingNoteId === note.id}
                    actionsDisabled={noteActionsDisabled}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Card>
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

const NoteItem = ({ note, formatDateTime, canEdit, canDelete, onEdit, onDelete, isEditing, actionsDisabled }) => (
  <div className="rounded-lg border border-border bg-card/60 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-secondary/70 p-2">
          <MessageSquare className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {note.author?.name || 'Unknown contributor'}
            {note.isPrivate && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Private
              </span>
            )}
            {isEditing && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <Edit className="h-3 w-3" />
                Editing
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(note.createdAt)} - {note.author?.role ?? 'Contributor'}
          </p>
        </div>
      </div>
      {(canEdit || canDelete) && (
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit note" disabled={actionsDisabled}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="Delete note"
              disabled={actionsDisabled}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
    <p className="mt-3 text-sm leading-relaxed text-foreground">{note.content}</p>

    {note.reminder && (
      <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
        <Bell className="h-3.5 w-3.5 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">{note.reminder.title}</p>
          <p>{note.reminder.description}</p>
          <p className="text-amber-700/80">
            Due {formatDateTime(note.reminder.dueDate)} - Priority {note.reminder.priority}
          </p>
        </div>
      </div>
    )}
  </div>
);
export default CandidateDetailPage;





