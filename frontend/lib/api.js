// Centralized API base URL selection so the frontend can run in different environments.
const resolveApiUrl = () => {
  const defaultUrl = 'http://localhost:3001';

  if (typeof window === 'undefined') {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || defaultUrl;
  }

  return process.env.NEXT_PUBLIC_API_URL || defaultUrl;
};

export const API_URL = resolveApiUrl();

export default API_URL;
