import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  User,
  Users,
  Briefcase,
  Target,
  TrendingUp,
  Edit,
  Save,
  X,
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

const CandidateDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [dailyApps, setDailyApps] = useState(0);
  const [totalApps, setTotalApps] = useState(0);
  const [error, setError] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);
  const [noteFollowUpEnabled, setNoteFollowUpEnabled] = useState(false);
  const [noteFollowUpDueDate, setNoteFollowUpDueDate] = useState('');
  const [noteFollowUpTitle, setNoteFollowUpTitle] = useState('');
  const [noteFollowUpDescription, setNoteFollowUpDescription] = useState('');
  const [noteFollowUpPriority, setNoteFollowUpPriority] = useState(1);
  const [noteMessage, setNoteMessage] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);

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

  useEffect(() => {
    if (candidate && !editing) {
      setDailyApps(candidate.daily_applications || 0);
      setTotalApps(candidate.total_applications || 0);
    }
  }, [candidate, editing]);

  const {
    data: notes = [],
    isLoading: notesLoading,
  } = useCandidateNotesQuery(token, candidateId, Boolean(token && candidateId));

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

      await queryClient.invalidateQueries({
        queryKey: queryKeys.candidates(token),
      });
      setEditing(false);
      setError('');
    } catch (updateError) {
      console.error('Error updating candidate:', updateError);
      setError(updateError.message);
    }
  };

  const handleCancel = () => {
    if (!candidate) return;
    setDailyApps(candidate.daily_applications || 0);
    setTotalApps(candidate.total_applications || 0);
    setEditing(false);
    setError('');
  };

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



