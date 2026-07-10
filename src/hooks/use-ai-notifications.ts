"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAiNotificationsStore } from "@/stores/ai-notifications";

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";

let socket: Socket | null = null;

/**
 * Connects once per browser tab to the standalone Socket.io realtime server,
 * authenticating with a short-lived JWT minted by /api/ai/realtime-token.
 * Mount this once near the dashboard shell root — every AI notification
 * (forecast completions, recommendations) flows through the shared
 * useAiNotificationsStore this hook feeds.
 */
export function useAiNotifications() {
  const push = useAiNotificationsStore((s) => s.push);
  const setConnected = useAiNotificationsStore((s) => s.setConnected);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const response = await fetch("/api/ai/realtime-token");
      if (!response.ok || cancelled) return;
      const { data } = (await response.json()) as { data: { token: string } };
      if (cancelled) return;

      socket = io(REALTIME_URL, { auth: { token: data.token }, transports: ["websocket"] });
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("ai:recommendation", (payload: Record<string, unknown>) => {
        push("ai:recommendation", payload);
        toast.info("New AI recommendation", {
          description: typeof payload.type === "string" ? payload.type : undefined,
        });
      });
    }

    void connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socket = null;
    };
  }, [push, setConnected]);
}
