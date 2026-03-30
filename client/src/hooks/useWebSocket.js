import { useEffect, useState, useCallback, useRef } from 'react';

function getWebSocketUrl() {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl && /^wss?:\/\//.test(envUrl)) {
    return envUrl;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = envUrl || '/ws';
  return `${protocol}//${window.location.host}${path}`;
}

export function useWebSocket() {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      wsRef.current = new WebSocket(getWebSocketUrl());

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;

        // Send auth token
        wsRef.current.send(JSON.stringify({
          type: 'CONNECT',
          token,
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages(prev => [...prev, message]);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setTimeout(connect, reconnectDelay.current);
          reconnectDelay.current = Math.min(
            reconnectDelay.current * 2,
            30000 // Max 30 seconds
          );
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    messages,
    send,
    disconnect,
  };
}
