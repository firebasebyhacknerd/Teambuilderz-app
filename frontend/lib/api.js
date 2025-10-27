// Centralized API base URL selection so the frontend can run in different environments.
const buildBrowserUrl = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  const port =
    process.env.NEXT_PUBLIC_API_PORT ||
    (window.location.port === '3000' ? '3001' : window.location.port) ||
    '3001';

  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
};

const resolveApiUrl = () => {
  const defaultUrl = 'http://localhost:3001';
  const browserUrl = buildBrowserUrl();

  if (!browserUrl) {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || defaultUrl;
  }

  return process.env.NEXT_PUBLIC_API_URL || browserUrl || defaultUrl;
};

export const API_URL = resolveApiUrl();

export default API_URL;
