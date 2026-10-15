import { useState, useEffect } from 'react';

export function useInterviewStability(isInterviewActive: boolean) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [tabViolations, setTabViolations] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  // 1. Network Status Monitor
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Tab Visibility (Anti-Cheat) Monitor
  useEffect(() => {
    if (!isInterviewActive) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations((prev) => prev + 1);
        setShowCheatWarning(true);
        setTimeout(() => setShowCheatWarning(false), 5000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isInterviewActive]);

  // 3. Cross-Tab Duplicate Monitor (BroadcastChannel)
  useEffect(() => {
    const channel = new BroadcastChannel('interview_sync_lock');

    if (isInterviewActive) {
      channel.postMessage('I_AM_ACTIVE');
    } else {
      channel.postMessage('WHO_IS_ACTIVE');
    }

    channel.onmessage = (event) => {
      if (event.data === 'I_AM_ACTIVE' && !isInterviewActive) {
        setIsDuplicateTab(true);
      } else if (event.data === 'WHO_IS_ACTIVE' && isInterviewActive) {
        channel.postMessage('I_AM_ACTIVE');
      }
    };

    return () => channel.close();
  }, [isInterviewActive]);

  return { isOffline, tabViolations, showCheatWarning, isDuplicateTab };
}
