'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Wallet,
  Clock,
  Settings,
  FileText,
  Shield,
  Home,
} from 'lucide-react';

const MENU_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Inicio', exact: true },
  { href: '/dashboard/sessions', icon: Clock, label: 'Sesiones', exact: false },
  { href: '/dashboard/wallets', icon: Wallet, label: 'Wallets', exact: false },
  { href: '/dashboard/credentials', icon: FileText, label: 'Credenciales', exact: false },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', exact: false },
  { href: '/dashboard/compliance', icon: Shield, label: 'Compliance', exact: false },
  { href: '/dashboard/settings', icon: Settings, label: 'Configuración', exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-600">SYNAPSYS</h1>
      </div>

      <nav className="space-y-1 px-4">
        {MENU_ITEMS.map(item => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
