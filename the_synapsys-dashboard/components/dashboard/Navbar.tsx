'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {user?.rpName || 'Dashboard'}
          </h2>
          <p className="text-sm text-gray-500">{user?.name}</p>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </nav>
  );
}
