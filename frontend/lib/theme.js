import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tbz-theme';
const VALID_THEMES = new Set(['light', 'dark', 'system']);

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const getSystemPreference = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState(() => (typeof window === 'undefined' ? 'light' : getSystemPreference()));

  const applyTheme = useCallback(
    (nextTheme, { persist = true } = {}) => {
      if (typeof window === 'undefined') {
        return;
      }

      const root = document.documentElement;
      const systemPreference = getSystemPreference();
      const shouldUseDark =
        nextTheme === 'dark' || (nextTheme === 'system' && systemPreference === 'dark');

      root.classList.toggle('dark', shouldUseDark);
      root.setAttribute('data-theme', nextTheme);
      root.setAttribute('data-color-mode', shouldUseDark ? 'dark' : 'light');

      setResolvedTheme(shouldUseDark ? 'dark' : 'light');

      if (persist) {
        try {
          window.localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch (error) {
          // Ignore write errors (e.g., private mode)
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let initial = 'system';
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (VALID_THEMES.has(stored)) {
        initial = stored;
      }
    } catch (error) {
      initial = 'system';
    }

    setThemeState(initial);
    applyTheme(initial, { persist: false });
  }, [applyTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system', { persist: false });

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) {
      return;
    }
    setThemeState(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
