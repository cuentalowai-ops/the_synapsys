import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
};

export const formatRelativeTime = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { locale: es, addSuffix: true });
};

export const formatStatusBadge = (status: string): { text: string; color: string } => {
  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: 'Pendiente', color: 'yellow' },
    completed: { text: 'Completado', color: 'green' },
    expired: { text: 'Expirado', color: 'red' },
    revoked: { text: 'Revocado', color: 'gray' },
  };
  return statusMap[status] || { text: status, color: 'gray' };
};

export const calculateConversionRate = (completed: number, total: number): string => {
  if (total === 0) return '0%';
  return `${Math.round((completed / total) * 100)}%`;
};
