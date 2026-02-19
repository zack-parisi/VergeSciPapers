import { useState, useCallback, useEffect } from "react";

// Fetch pending connection requests for the user
export function useConnectionRequests(userId: string | undefined) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connection-requests/mongodb?toUserId=${userId}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return { requests, setRequests, loading, error, fetchRequests };
}

// Fetch outgoing connection requests sent by the user
export function useOutgoingConnectionRequests(userId: string | undefined) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connection-requests/mongodb?fromUserId=${userId}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch outgoing requests");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return { requests, setRequests, loading, error, fetchRequests };
}

// Send a connection request
export function useSendConnectionRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendRequest = useCallback(async (fromUserId: string, toUserId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/connection-requests/mongodb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      return data.request;
    } catch (e: any) {
      setError(e.message || "Failed to send request");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  return { sendRequest, loading, error };
}

// Accept or decline a connection request
export function useRespondToConnectionRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const respond = useCallback(async (fromUserId: string, toUserId: string, action: "ACCEPT" | "DECLINE") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/connection-requests/mongodb/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond");
      return data.request;
    } catch (e: any) {
      setError(e.message || "Failed to respond");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  return { respond, loading, error };
}

// Fetch accepted connections for the user
export function useConnections(userId: string | undefined) {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections/mongodb?userId=${userId}`);
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch connections");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  return { connections, loading, error, fetchConnections };
} 