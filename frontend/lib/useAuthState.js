import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import API_URL from './api';

const DEFAULT_STATE = {
  token: '',
  userName: 'Recruiter',
  userRole: 'Recruiter',
  ready: false,
};

export const useAuthState = ({ requireRole } = {}) => {
  const router = useRouter();
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    if (typeof window === 'undefined' || !router.isReady) {
      return;
    }

    const storedToken = window.localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const storedRole = window.localStorage.getItem('userRole') || 'Recruiter';
    if (requireRole && storedRole !== requireRole) {
      router.replace(storedRole === 'Admin' ? '/admin' : '/recruiter');
      return;
    }

    setState({
      token: storedToken,
      userRole: storedRole,
      userName: window.localStorage.getItem('userName') || 'Recruiter',
      ready: true,
    });
  }, [requireRole, router]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Failed to invalidate backend session during logout', error);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('userRole');
      window.localStorage.removeItem('userName');
      window.localStorage.removeItem('userId');
    }
    router.push('/login');
  }, [router]);

  return {
    ...state,
    logout,
  };
};

export default useAuthState;
