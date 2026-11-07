import { createContext, createElement, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

const AdminRealtimeContext = createContext(false);

const INVALIDATED_QUERY_PREFIXES = [
  ["/api/admin/dashboard"],
  ["/api/admin/automation/events"],
  ["/api/admin/disputes"],
  ["/api/admin/treasury/movements"],
] as const;

export function AdminRealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1_000;
    let socket: WebSocket | undefined;

    const refreshLiveData = () => {
      for (const queryKey of INVALIDATED_QUERY_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    };

    const connect = () => {
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const currentSocket = new WebSocket(
        `${protocol}//${window.location.host}/api/lance/ws`,
      );
      socket = currentSocket;

      currentSocket.addEventListener(
        "open",
        () => {
          reconnectDelay = 1_000;
          setConnected(true);
          refreshLiveData();
        },
        { once: true },
      );

      currentSocket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (
            message &&
            typeof message === "object" &&
            "type" in message &&
            message.type === "state_changed"
          ) {
            refreshLiveData();
          }
        } catch {
          // Ignore malformed or unrelated messages; the socket is invalidation-only.
        }
      });

      currentSocket.addEventListener(
        "close",
        () => {
          if (disposed) return;
          setConnected(false);
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = undefined;
            connect();
          }, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        },
        { once: true },
      );

      currentSocket.addEventListener(
        "error",
        () => currentSocket.close(),
        { once: true },
      );
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  return createElement(AdminRealtimeContext.Provider, { value: connected }, children);
}

export function useAdminRealtime(): boolean {
  return useContext(AdminRealtimeContext);
}
