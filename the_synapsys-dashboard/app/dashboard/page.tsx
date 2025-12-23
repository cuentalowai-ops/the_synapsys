'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useSessions } from '@/lib/hooks/useSessions';
import DashboardStats from '@/components/dashboard/DashboardStats';
import RecentSessions from '@/components/dashboard/RecentSessions';
import QuickActions from '@/components/dashboard/QuickActions';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { sessions, fetchSessions } = useSessions();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (token) fetchSessions(token);
    }
  }, [user, fetchSessions]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido, {user?.name || 'Usuario'}
        </h1>
        <p className="text-gray-600 mt-1">
          Gestiona tus sesiones de verificación digital
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStats sessions={sessions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentSessions sessions={sessions.slice(0, 5)} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
