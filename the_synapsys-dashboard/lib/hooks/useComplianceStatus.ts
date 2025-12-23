'use client';

import { useState, useEffect } from 'react';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'LOADING';

interface ComplianceState {
  status: ComplianceStatus;
  lastChecked: Date | null;
  error: string | null;
}

const COMPLIANCE_URL =
  'https://raw.githubusercontent.com/cuentalowai-ops/the_synapsys/main/COMPLIANCE_STATUS.md';

const REFRESH_INTERVAL = 75000; // 75 seconds (between 60-90s as requested)

/**
 * Hook to fetch and monitor compliance status from GitHub
 */
export function useComplianceStatus() {
  const [state, setState] = useState<ComplianceState>({
    status: 'LOADING',
    lastChecked: null,
    error: null,
  });

  const checkCompliance = async () => {
    try {
      const response = await fetch(COMPLIANCE_URL, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch compliance status: ${response.status}`);
      }

      const content = await response.text();
      const isCompliant = parseComplianceStatus(content);

      setState({
        status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
        lastChecked: new Date(),
        error: null,
      });
    } catch (error) {
      console.error('Compliance check failed:', error);
      setState({
        status: 'NON_COMPLIANT',
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  useEffect(() => {
    // Initial check
    checkCompliance();

    // Set up polling interval
    const interval = setInterval(checkCompliance, REFRESH_INTERVAL);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  return state;
}

/**
 * Parse the markdown content to determine compliance status
 */
function parseComplianceStatus(content: string): boolean {
  // Check for all three required conditions
  const hasCIPipeline = content.includes('CI pipeline: Operational');
  const hasWatchdog = content.includes('Compliance watchdog: Active for main branch');
  const hasAutoCommit = content.includes('Auto-commit of compliance reports: Enabled');

  return hasCIPipeline && hasWatchdog && hasAutoCommit;
}
