// src/hooks/useWebSocket.js
import { useEffect, useRef } from 'react';

export default function useWebSocket(baseUrl, onMessage, onOpen, onClose) {
  const ws = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(baseUrl.replace('http://', 'ws://') + '/ws');
    ws.current = socket;

    socket.onmessage = (e) => onMessage?.(e.data);
    socket.onopen = () => onOpen?.();
    socket.onclose = () => onClose?.();

    return () => socket.close();
  }, [baseUrl]);

  const send = (msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(msg);
    }
  };

  return { send, ws };
}