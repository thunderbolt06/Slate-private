'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = (localStorage.getItem('slate-theme') as Theme) || 'light';
    setThemeState(saved);
    applyTheme(saved);
    // Listen for system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if ((localStorage.getItem('slate-theme') as Theme) === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTheme = (t: Theme) => {
    const resolved = resolveTheme(t);
    setResolvedTheme(resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const setTheme = (t: Theme) => {
    localStorage.setItem('slate-theme', t);
    setThemeState(t);
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
