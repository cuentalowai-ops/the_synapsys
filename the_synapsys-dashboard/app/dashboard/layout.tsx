'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import Navbar from '@/components/dashboard/Navbar';
import Sidebar from '@/components/dashboard/Sidebar';
import { Loader } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
