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
