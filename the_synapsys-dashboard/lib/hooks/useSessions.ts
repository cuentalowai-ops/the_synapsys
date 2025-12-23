'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { VPSession, Credential } from '../api/types';

export const useSessions = () => {
  const [sessions, setSessions] = useState<VPSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all sessions
   */
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.sessions.list();

      if (response.status === 'success') {
        const sessionsList = response.sessions || [];
        setSessions(sessionsList);
      } else {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(
    async (
      clientId: string,
      walletType: 'igrant' | 'gataca' | 'other',
      requiredVps: string[] = ['VerifiableCredential']
    ): Promise<VPSession | null> => {
      try {
        setLoading(true);
        setError(null);

        const redirectUri =
          typeof window !== 'undefined'
            ? `${window.location.origin}/dashboard/sessions/callback`
            : 'http://localhost:3000/dashboard/sessions/callback';

        const response = await api.sessions.create({
          client_id: clientId,
          required_vps: requiredVps,
          redirect_uri: redirectUri,
          wallet_type: walletType,
        });

        if (response.status === 'success' && response.session) {
          const newSession = response.session;
          setSessions((prev) => [newSession, ...prev]);
          return newSession;
        }

        throw new Error(response.error || 'Failed to create session');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create session';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get a specific session
   */
  const getSession = useCallback(
    async (sessionId: string): Promise<VPSession | null> => {
      try {
        const response = await api.sessions.get(sessionId);
        if (response.status === 'success' && response.data) {
          return response.data;
        }
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch session');
        return null;
      }
    },
    []
  );

  /**
   * Complete a session with credential
   */
  const completeSession = useCallback(
    async (sessionId: string, credential: Credential): Promise<boolean> => {
      try {
        const response = await api.sessions.complete(sessionId, credential);
        if (response.status === 'success') {
          // Update session in list
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId ? { ...s, status: 'completed' } : s
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete session');
        return false;
      }
    },
    []
  );

  /**
   * Revoke a session
   */
  const revokeSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const response = await api.sessions.revoke(sessionId);
        if (response.status === 'success') {
          // Update session in list
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId ? { ...s, status: 'revoked' } : s
            )
          );
          return true;
        }
        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke session');
        return false;
      }
    },
    []
  );

  // Auto-fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    getSession,
    completeSession,
    revokeSession,
  };
};
