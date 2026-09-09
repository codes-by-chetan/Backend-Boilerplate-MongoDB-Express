import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useSocket(token) {
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveStream, setLiveStream] = useState([]);
  const [streamPaused, setStreamPaused] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({
    inFlightRequests: 0,
    totalRequests: 0,
    activeSockets: 0,
  });

  const streamPausedRef = useRef(streamPaused);
  useEffect(() => {
    streamPausedRef.current = streamPaused;
  }, [streamPaused]);

  useEffect(() => {
    // In Vite dev or production, connect to current host origin
    const socket = io({
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      if (token) {
        socket.emit("join-admin", { token });
      }
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("admin-joined", (data) => {
      if (data?.metrics) {
        setLiveMetrics((prev) => ({ ...prev, ...data.metrics }));
        if (data.metrics.recentRequests?.length) {
          setLiveStream(data.metrics.recentRequests);
        }
      }
    });

    socket.on("request:start", (data) => {
      setLiveMetrics((prev) => ({
        ...prev,
        inFlightRequests: data.inFlightRequests || prev.inFlightRequests + 1,
      }));
    });

    socket.on("request:finish", (data) => {
      if (data?.metrics) {
        setLiveMetrics((prev) => ({ ...prev, ...data.metrics }));
      }
      if (!streamPausedRef.current) {
        setLiveStream((prev) => [data, ...prev.slice(0, 99)]);
      }
    });

    socket.on("system:stats", (data) => {
      if (data) {
        setLiveMetrics((prev) => ({ ...prev, ...data }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const clearStream = () => setLiveStream([]);
  const togglePauseStream = () => setStreamPaused((prev) => !prev);

  return {
    socketConnected,
    liveStream,
    streamPaused,
    liveMetrics,
    clearStream,
    togglePauseStream,
  };
}
