'use client';

import { BarChart3, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Session {
  id: string;
  status: 'pending' | 'completed' | 'expired' | 'revoked';
}

interface Props {
  sessions: Session[];
}

export default function DashboardStats({ sessions }: Props) {
  const total = sessions.length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const pending = sessions.filter(s => s.status === 'pending').length;
  const failed = sessions.filter(s => s.status === 'expired' || s.status === 'revoked').length;

  const stats = [
    {
      label: 'Total Sesiones',
      value: total,
      icon: BarChart3,
      color: 'blue',
    },
    {
      label: 'Completadas',
      value: completed,
      icon: CheckCircle,
      color: 'green',
    },
    {
      label: 'Pendientes',
      value: pending,
      icon: Clock,
      color: 'yellow',
    },
    {
      label: 'Fallidas',
      value: failed,
      icon: XCircle,
      color: 'red',
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <>
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
