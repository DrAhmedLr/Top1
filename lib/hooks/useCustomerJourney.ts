'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {type AnalyticsView} from '../analytics';
import {startCustomerJourney} from '../customerJourneyClient';

type Setting = {owner: string; enabled: boolean; consentId: string | null};
export function useCustomerJourney(owner: string | undefined, pathname: string, currentScreen: () => AnalyticsView | undefined) {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const subscription = useRef<BroadcastChannel | null>(null);
  const change = useCallback(async (enabled?: boolean) => {
    if (!owner) return;
    const ticket = ++generation.current;
    setBusy(true); setFailed(false);
    if (enabled === false) setSetting(null);
    try {
      const response = await fetch('/api/customer-journey', {
        method: enabled === undefined ? 'GET' : 'POST', cache:'no-store',
        headers: {'X-Profile-User':owner, ...(enabled === undefined ? {} : {'Content-Type':'application/json'})},
        body: enabled === undefined ? undefined : JSON.stringify({enabled})
      });
      if (!response.ok) throw Error('Journey preference unavailable');
      const result = await response.json();
      if (typeof result.enabled !== 'boolean' || (result.enabled && typeof result.consentId !== 'string')) throw Error('Invalid journey preference');
      if (generation.current === ticket) {
        setSetting({owner, enabled:result.enabled, consentId:result.consentId ?? null});
        if (enabled !== undefined) subscription.current?.postMessage('refresh');
      }
    } catch {
      if (ticket === generation.current) { setSetting(null); setFailed(true); }
    } finally { if (generation.current === ticket) setBusy(false); }
  }, [owner]);
  useEffect(() => {
    setSetting(null); setFailed(false); setBusy(false);
    if (!owner) return;
    void change();
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('top1-journey-settings') : null;
    if (channel) channel.onmessage = () => void change();
    subscription.current = channel;
    return () => { generation.current++; channel?.close(); subscription.current = null; };
  }, [owner, change]);
  const consentId = owner && owner === setting?.owner && setting.enabled ? setting.consentId : null;
  const eligible = pathname === '/' || pathname === '/privacy' || pathname.startsWith('/share/');
  useEffect(() => {
    if (owner && consentId && eligible) return startCustomerJourney(owner, consentId, currentScreen());
  }, [owner, consentId, eligible, currentScreen]);
  return {enabled: Boolean(consentId), busy, failed, change};
}
