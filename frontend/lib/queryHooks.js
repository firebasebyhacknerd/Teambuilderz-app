import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API_URL from './api';

const handleResponse = async (response, fallbackMessage) => {
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    const message = payload?.message || fallbackMessage;
    throw new Error(message);
  }

  return payload;
};

const buildHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const queryKeys = {
  applications: (token) => ['applications', token],
  candidates: (token) => ['candidates', token],
  reports: (token, scope) => ['reports', scope, token],
  candidateNotes: (token, candidateId) => ['candidate-notes', token, candidateId],
  adminOverview: (token) => ['admin-overview', token],
  adminActivity: (token) => ['admin-activity', token],
  notifications: (token) => ['notifications', token],
  userActivity: (token) => ['user-activity', token],
  users: (token) => ['users', token],
  leaderboard: (token) => ['leaderboard', token],
  candidateAssignments: (token, candidateId) => ['candidate-assignments', token, candidateId],
  interviews: (token, params) => ['interviews', token, params ? JSON.stringify(params) : null],
  assessments: (token, params) => ['assessments', token, params ? JSON.stringify(params) : null],
  recruiterProfile: (token, userId) => ['recruiter-profile', token, userId],
};

export const useApplicationsQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.applications(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/applications`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load applications.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: [],
  });

export const useCandidatesQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.candidates(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/candidates`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load candidates.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: [],
  });

const buildSearchParams = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || Number.isNaN(normalized)) return;
    searchParams.append(key, normalized);
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export const useInterviewsQuery = (token, params = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.interviews(token, params),
    queryFn: async () => {
      const query = buildSearchParams(params);
      const response = await fetch(`${API_URL}/api/v1/interviews${query}`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load interviews.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: [],
  });

export const useAssessmentsQuery = (token, params = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.assessments(token, params),
    queryFn: async () => {
      const query = buildSearchParams(params);
      const response = await fetch(`${API_URL}/api/v1/assessments${query}`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load assessments.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: [],
  });

export const useCreateInterviewMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await fetch(`${API_URL}/api/v1/interviews`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });
      return handleResponse(response, 'Unable to log interview.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'interviews',
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useCreateAssessmentMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await fetch(`${API_URL}/api/v1/assessments`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });
      return handleResponse(response, 'Unable to log assessment.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'assessments',
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useUpdateInterviewMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ interviewId, payload }) => {
      const response = await fetch(`${API_URL}/api/v1/interviews/${interviewId}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });
      return handleResponse(response, 'Unable to update interview.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'interviews',
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useApproveInterviewMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ interviewId, approved = true }) => {
      const response = await fetch(`${API_URL}/api/v1/interviews/${interviewId}/approval`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ approved }),
      });
      return handleResponse(response, 'Unable to update interview approval.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'interviews',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useUpdateAssessmentMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assessmentId, payload }) => {
      const response = await fetch(`${API_URL}/api/v1/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });
      return handleResponse(response, 'Unable to update assessment.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'assessments',
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useApproveAssessmentMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assessmentId, approved = true }) => {
      const response = await fetch(`${API_URL}/api/v1/assessments/${assessmentId}/approval`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ approved }),
      });
      return handleResponse(response, 'Unable to update assessment approval.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => Array.isArray(queryKey) && queryKey[0] === 'assessments',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useUpdateApplicationMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, payload }) => {
      const response = await fetch(`${API_URL}/api/v1/applications/${applicationId}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });

      return handleResponse(response, 'Unable to update application.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useApproveApplicationMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, approved = true }) => {
      const response = await fetch(`${API_URL}/api/v1/applications/${applicationId}/approval`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ approved }),
      });

      return handleResponse(response, 'Unable to update application approval.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useDeleteApplicationMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId) => {
      const response = await fetch(`${API_URL}/api/v1/applications/${applicationId}`, {
        method: 'DELETE',
        headers: buildHeaders(token),
      });

      return handleResponse(response, 'Unable to delete application.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useLogApplicationMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      application,
      interview,
      assessment,
      includeInterview,
      includeAssessment,
    }) => {
      const applicationResponse = await fetch(`${API_URL}/api/v1/applications`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify(application),
      });

      const createdApplication = await handleResponse(
        applicationResponse,
        'Unable to log application. Please try again.',
      );

      if (includeInterview) {
        const interviewResponse = await fetch(`${API_URL}/api/v1/interviews`, {
          method: 'POST',
          headers: buildHeaders(token),
          body: JSON.stringify({
            ...interview,
            candidate_id: application.candidate_id,
            application_id: createdApplication.id,
          }),
        });

        await handleResponse(
          interviewResponse,
          'Application saved, but interview logging failed.',
        );
      }

      if (includeAssessment) {
        const assessmentResponse = await fetch(`${API_URL}/api/v1/assessments`, {
          method: 'POST',
          headers: buildHeaders(token),
          body: JSON.stringify({
            ...assessment,
            candidate_id: application.candidate_id,
            application_id: createdApplication.id,
          }),
        });

        await handleResponse(
          assessmentResponse,
          'Application saved, but assessment logging failed.',
        );
      }

      return createdApplication;
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useCandidateNotesQuery = (token, candidateId, enabled = true) =>
  useQuery({
    queryKey: queryKeys.candidateNotes(token, candidateId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}/notes`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load candidate notes.');
    },
    enabled: Boolean(token) && Boolean(candidateId) && enabled,
    placeholderData: [],
    refetchInterval: 10000,
  });

export const useCreateCandidateNoteMutation = (token, candidateId, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}/notes`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });

      return handleResponse(response, 'Unable to log note.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidateNotes(token, candidateId),
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useUpdateCandidateNoteMutation = (token, candidateId, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, payload }) => {
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}/notes/${noteId}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });

      return handleResponse(response, 'Unable to update note.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidateNotes(token, candidateId),
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useDeleteCandidateNoteMutation = (token, candidateId, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId) => {
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: buildHeaders(token),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to delete note.');
      }
      return true;
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.candidateNotes(token, candidateId),
      });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useAdminOverviewQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.adminOverview(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/reports/overview`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load overview metrics.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: null,
  });

export const useAdminActivityQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.adminActivity(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/reports/activity`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load recent activity.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: {
      recentNotes: [],
      upcomingReminders: [],
      recruiterNotes: [],
      notesByRecruiter: [],
    },
    refetchInterval: 30000,
  });

export const useNotificationsQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.notifications(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/notifications`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load notifications.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: { reminders: [], alerts: [] },
    refetchInterval: 15000,
  });

export const useLeaderboardQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.leaderboard(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/reports/leaderboard`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load recruiter leaderboard.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: { leaderboard: [], generatedAt: null },
    refetchInterval: 60000,
  });

export const useUserActivityQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.userActivity(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/users/activity`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load user activity.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: { users: [], generatedAt: null },
    refetchInterval: 30000,
  });

export const useCandidateAssignmentsQuery = (token, candidateId, enabled = true) =>
  useQuery({
    queryKey: queryKeys.candidateAssignments(token, candidateId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/candidates/${candidateId}/assignments`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load assignment history.');
    },
    enabled: Boolean(token) && Boolean(candidateId) && enabled,
    placeholderData: [],
    refetchInterval: 30000,
  });

export const useRecruiterProfileQuery = (token, userId, enabled = true) =>
  useQuery({
    queryKey: queryKeys.recruiterProfile(token, userId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/users/${userId}/profile`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load recruiter profile.');
    },
    enabled: Boolean(token) && Boolean(userId) && enabled,
    retry: false,
  });

export const useUsersQuery = (token, enabled = true) =>
  useQuery({
    queryKey: queryKeys.users(token),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/v1/users`, {
        headers: buildHeaders(token),
      });
      return handleResponse(response, 'Unable to load users.');
    },
    enabled: Boolean(token) && enabled,
    placeholderData: [],
    refetchInterval: 60000,
  });

export const useCreateUserMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await fetch(`${API_URL}/api/v1/users`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });

      return handleResponse(response, 'Unable to create user.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userActivity(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useUpdateUserMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, payload }) => {
      const response = await fetch(`${API_URL}/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });

      return handleResponse(response, 'Unable to update user.');
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userActivity(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

export const useDeleteUserMutation = (token, options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`${API_URL}/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: buildHeaders(token),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Unable to delete user.');
      }
      return true;
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(token) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userActivity(token) });
      if (options?.onSuccess) {
        options.onSuccess(...args);
      }
    },
    ...options,
  });
};

