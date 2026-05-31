"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";

type PresenceMap = Record<string, "online" | "away" | "offline">;

const PresenceContext = createContext<PresenceMap>({});

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const { socket: presenceSocket } = useSocket("/presence");

  useEffect(() => {
    // Initial fetch of all online users
    fetch("/api/presence")
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setPresenceMap(json.data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!presenceSocket) return;

    const handleUpdate = (data: { userId: string; status: "online" | "away" | "offline" }) => {
      setPresenceMap(prev => {
        const next = { ...prev };
        if (data.status === "offline") {
          delete next[data.userId];
        } else {
          next[data.userId] = data.status;
        }
        return next;
      });
    };

    presenceSocket.on("presence_update", handleUpdate);

    // Send ping every 30 seconds to keep presence alive (server TTL is 65s)
    const pingInterval = setInterval(() => {
      if (presenceSocket.connected) {
        presenceSocket.emit("ping");
      }
    }, 30000);

    return () => {
      presenceSocket.off("presence_update", handleUpdate);
      clearInterval(pingInterval);
    };
  }, [presenceSocket]);

  return (
    <PresenceContext.Provider value={presenceMap}>
      {children}
    </PresenceContext.Provider>
  );
}
