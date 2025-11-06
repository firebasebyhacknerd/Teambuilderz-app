// Centralized API base URL selection so the frontend can run in different environments.
const buildBrowserUrl = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  const browserPort = window.location.port;

  // When the app runs behind the HTTPS nginx proxy there is no explicit port,
  // so we have to route API calls through the proxied /api path.
  if (protocol === 'https:' && (!browserPort || browserPort === '443')) {
    return `${protocol}//${hostname}/api`;
  }

  const port =
    process.env.NEXT_PUBLIC_API_PORT ||
    (browserPort === '3000' ? '3001' : browserPort) ||
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
