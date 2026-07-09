"use client";

import { useEffect, useRef, useState } from "react";

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;

async function pingServer(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * navigator.onLine alone false-positives — a device can be "online" (has a
 * link) with no real route to this server. A heartbeat to /api/health is
 * the ground truth; navigator.onLine is only used to skip the heartbeat
 * fetch entirely when there's obviously no link at all.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  // The interval timer and the online/offline DOM events can both trigger
  // checkNow() concurrently; their pingServer() calls can then resolve out
  // of order (a slow, now-stale "online" check finishing after a fresh
  // "offline" event already fired). Only the most recently *started* check
  // is allowed to apply its result, so a stale one can't clobber a newer one.
  const latestCheckId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function checkNow() {
      const checkId = ++latestCheckId.current;

      if (!navigator.onLine) {
        if (!cancelled && checkId === latestCheckId.current) setIsOnline(false);
        return;
      }
      const reachable = await pingServer();
      if (!cancelled && checkId === latestCheckId.current) setIsOnline(reachable);
    }

    checkNow();
    const interval = setInterval(checkNow, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("online", checkNow);
    window.addEventListener("offline", checkNow);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", checkNow);
      window.removeEventListener("offline", checkNow);
    };
  }, []);

  return isOnline;
}
