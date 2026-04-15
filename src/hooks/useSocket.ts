"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

// Module-level socket cache — one socket instance per namespace
const sockets: Record<string, Socket> = {};

/**
 * Subscribes to a Socket.io namespace. The socket instance is kept in React state
 * (not only a ref) so consumers re-render after connect — refs alone do not trigger
 * re-renders, which previously left `socket` as null until an unrelated state update.
 */
export function useSocket(namespace: string) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!sockets[namespace]) {
      sockets[namespace] = io(namespace, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    }
    const s = sockets[namespace];
    setSocket(s);

    if (s.connected) setConnected(true);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [namespace]);

  return { socket, connected };
}
