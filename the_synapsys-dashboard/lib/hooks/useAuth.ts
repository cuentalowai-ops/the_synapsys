'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AuthUser } from '../api/types';

export const useAuth = () => {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);

        // Try to get user from backend
        try {
          const response = await api.auth.me();
          if (response.status === 'success' && response.data) {
            setUser(response.data as AuthUser);
            setError(null);
            return;
          }
        } catch (apiError) {
          // If API fails, try to use stored user data (fallback)
          const token = localStorage.getItem('token');
          const storedUser = localStorage.getItem('user');

          if (token && storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              setError(null);
              return;
            } catch (parseError) {
              console.error('Failed to parse stored user:', parseError);
            }
          }
        }

        // No valid session found, redirect to login
        setUser(null);
        if (!window.location.pathname.includes('/login')) {
          router.push('/login');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auth error');
        if (!window.location.pathname.includes('/login')) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.auth.login(email, password);

        if (response.status === 'success' && response.access_token && response.user) {
          // Store token and user
          localStorage.setItem('token', response.access_token);
          localStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);

          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          throw new Error(response.error || 'Login failed');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Login failed';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  return {
    user,
    loading,
    error,
    logout,
    login,
    isAuthenticated: !!user,
  };
};
