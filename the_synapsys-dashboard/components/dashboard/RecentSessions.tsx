'use client';

import Link from 'next/link';
import { formatDate, formatStatusBadge } from '@/lib/utils/formatters';

interface Session {
  id: string;
  walletType: string;
  status: 'pending' | 'completed' | 'expired' | 'revoked';
  createdAt: string;
}

interface Props {
  sessions: Session[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  revoked: 'bg-gray-100 text-gray-800',
};

export default function RecentSessions({ sessions }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Sesiones Recientes</h2>
      </div>

      <div className="divide-y divide-gray-200">
        {sessions.length === 0 ? (
          <p className="p-6 text-center text-gray-600">Sin sesiones</p>
        ) : (
          sessions.map(session => {
            const statusInfo = formatStatusBadge(session.status);
            return (
              <Link
                key={session.id}
                href={`/dashboard/sessions/${session.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{session.walletType}</p>
                    <p className="text-sm text-gray-600">{formatDate(session.createdAt)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[session.status]}`}>
                    {statusInfo.text}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {sessions.length > 0 && (
        <div className="p-6 border-t border-gray-200 text-center">
          <Link href="/dashboard/sessions" className="text-blue-600 hover:text-blue-700 font-medium">
            Ver todas las sesiones
          </Link>
        </div>
      )}
    </div>
  );
}
