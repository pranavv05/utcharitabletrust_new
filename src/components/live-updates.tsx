'use client';
import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '@/lib/supabase/browser';
/** The replicated row contains a counter, never private operational data. */
export function useLiveChanges(scope: 'admin' | 'catalogue' | 'content', onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [state, setState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  useEffect(() => {
    const db = browserClient();
    if (!db) {
      setState('polling');
      return;
    }
    let stopped = false,
      last: string | undefined,
      timer: ReturnType<typeof setTimeout>;
    let checking = false;
    const changed = (version: unknown) => {
      const next = String(version);
      if (next !== last && (last !== undefined || scope === 'admin')) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!stopped) callback.current();
        }, 180);
      }
      last = next;
    };
    const check = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const {data, error} = await db.from('trust_changes').select('version').eq('scope', scope).single();
        if (data && !stopped) changed(data.version);
        else if (!stopped && scope === 'admin' && error?.code === 'PGRST116') callback.current();
      } finally {
        checking = false;
      }
    };
    const channel = db
      .channel('trust-changes-' + scope)
      .on(
        'postgres_changes',
        {event: 'UPDATE', schema: 'public', table: 'trust_changes', filter: `scope=eq.${scope}`},
        (payload: {new: Record<string, unknown>}) => {
          if (!stopped) changed(payload.new.version);
        },
      )
      .subscribe((status: string) => {
        if (!stopped) {
          setState(status === 'SUBSCRIBED' ? 'live' : 'polling');
          if (status === 'SUBSCRIBED') void check();
        }
      });
    void check();
    const interval = setInterval(check, 15000);
    const wake = () => void check();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      void db.removeChannel(channel);
    };
  }, [scope]);
  return state;
}
export function AdminLive() {
  const router = useRouter();
  const [lastSync, setLastSync] = useState('');
  const state = useLiveChanges('admin', () => {
    setLastSync(new Date().toISOString());
    window.dispatchEvent(new Event('trust:changed'));
    router.refresh();
  });
  return (
    <span
      className={'admin-live ' + state}
      title={
        (state === 'live' ? 'Changes sync across staff sessions' : 'Checking for changes every 15 seconds') +
        (lastSync ? ' · Last sync: ' + lastSync : '')
      }
    >
      <i />
      {state === 'live' ? 'Live updates' : state === 'connecting' ? 'Connecting…' : 'Auto refresh'}
    </span>
  );
}
export function SiteLive() {
  const router = useRouter();
  useLiveChanges('content', () => router.refresh());
  return null;
}
