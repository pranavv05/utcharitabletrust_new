'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');

  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme !== 'dark';
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('ut-theme', next ? 'dark' : 'light'); } catch { /* The theme still works without persistent storage. */ }
  }

  return <button className="icon-button theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} title={`Switch to ${dark ? 'light' : 'dark'} theme`}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>;
}
