'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSessions } from '@/lib/hooks/useSessions';
import { formatDate, formatStatusBadge } from '@/lib/utils/formatters';
import { Loader, QrCode } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  revoked: 'bg-gray-100 text-gray-800',
};

export default function SessionsPage() {
  const { user } = useAuth();
  const { sessions, fetchSessions, loading } = useSessions();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (token) fetchSessions(token);
    }
  }, [user, fetchSessions]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sesiones</h1>
          <p className="text-gray-600 mt-1">Gestiona tus sesiones de verificación</p>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Volver al Dashboard
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="animate-spin w-8 h-8 text-blue-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Sin sesiones activas. La integración con el backend permitirá crear sesiones.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Wallet</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Creada</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Credenciales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map(session => {
                const statusInfo = formatStatusBadge(session.status);
                return (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {session.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 capitalize">
                      {session.walletType}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[session.status]}`}>
                        {statusInfo.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(session.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {session.credentials?.length || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
