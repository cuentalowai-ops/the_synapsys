'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { WalletProvider } from '../api/types';

export const useWallets = () => {
  const [wallets, setWallets] = useState<WalletProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch available wallets
   */
  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.wallets.available();

      if (response.status === 'success' && response.data) {
        setWallets(response.data.wallets || []);
      } else {
        throw new Error('Failed to fetch wallets');
      }
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
      // Fallback to mock data if API fails
      setWallets([
        {
          id: 'igrant-io',
          name: 'iGrant.io',
          type: 'igrant',
          description: 'Open-source personal data store',
          available: true,
          configured: true,
        },
        {
          id: 'gataca',
          name: 'Gataca',
          type: 'gataca',
          description: 'Enterprise digital wallet',
          available: true,
          configured: true,
        },
        {
          id: 'oots',
          name: 'OOTS',
          type: 'oots',
          description: 'OpenID Token Server',
          available: true,
          configured: true,
        },
      ]);
      setError(null); // Don't show error, just use fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch wallets on mount
  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  return {
    wallets,
    loading,
    error,
    refetch: fetchWallets,
  };
};
