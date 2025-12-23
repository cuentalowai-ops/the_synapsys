'use client';

import { useComplianceStatus } from '@/lib/hooks/useComplianceStatus';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, Loader2 } from 'lucide-react';

interface ComplianceStatusProps {
  className?: string;
}

export default function ComplianceStatus({ className = '' }: ComplianceStatusProps) {
  const { status, lastChecked, error } = useComplianceStatus();

  const getStatusConfig = () => {
    switch (status) {
      case 'COMPLIANT':
        return {
          text: 'SYSTEM: COMPLIANT',
          borderColor: 'border-green-500',
          glowColor: 'shadow-[0_0_15px_rgba(34,197,94,0.5)]',
          textColor: 'text-green-400',
          bgColor: 'bg-black',
          icon: Shield,
          animate: false,
        };
      case 'NON_COMPLIANT':
        return {
          text: 'SYSTEM: NON‑COMPLIANT',
          borderColor: 'border-red-500',
          glowColor: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]',
          textColor: 'text-red-400',
          bgColor: 'bg-gray-900',
          icon: ShieldAlert,
          animate: true,
        };
      case 'LOADING':
      default:
        return {
          text: 'SYSTEM: SCANNING…',
          borderColor: 'border-yellow-500',
          glowColor: 'shadow-[0_0_15px_rgba(234,179,8,0.5)]',
          textColor: 'text-yellow-400',
          bgColor: 'bg-gray-900',
          icon: Loader2,
          animate: true,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const blinkAnimation = config.animate
    ? {
        opacity: [1, 0.4, 1],
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    : {};

  const getTooltipText = () => {
    if (error) {
      return `Unable to fetch compliance status from GitHub: ${error}`;
    }
    if (lastChecked) {
      return `Last checked: ${lastChecked.toLocaleTimeString()}`;
    }
    return 'Checking compliance status...';
  };

  return (
    <motion.div
      className={`${config.bgColor} ${config.borderColor} ${config.glowColor} border-2 rounded-sm px-4 py-2 ${className}`}
      animate={blinkAnimation}
      title={getTooltipText()}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 ${config.textColor} ${
            status === 'LOADING' ? 'animate-spin' : ''
          }`}
        />
        <span
          className={`${config.textColor} font-mono text-sm font-bold tracking-wider uppercase`}
          style={{
            textShadow:
              status === 'COMPLIANT'
                ? '0 0 10px rgba(34, 197, 94, 0.8)'
                : status === 'NON_COMPLIANT'
                  ? '0 0 10px rgba(239, 68, 68, 0.8)'
                  : '0 0 10px rgba(234, 179, 8, 0.8)',
          }}
        >
          {config.text}
        </span>
      </div>

      {error && (
        <p className="text-xs text-gray-400 mt-1 font-mono">
          GitHub sync failed
        </p>
      )}
    </motion.div>
  );
}
