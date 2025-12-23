'use client';

import Link from 'next/link';
import { Plus, Settings, FileText } from 'lucide-react';

export default function QuickActions() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>

      <div className="space-y-3">
        <Link
          href="/dashboard/sessions"
          className="flex items-center gap-3 p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Sesión</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 p-3 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>Configuración</span>
        </Link>

        <Link
          href="/dashboard/compliance"
          className="flex items-center gap-3 p-3 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
        >
          <FileText className="w-5 h-5" />
          <span>Compliance</span>
        </Link>
      </div>
    </div>
  );
}
