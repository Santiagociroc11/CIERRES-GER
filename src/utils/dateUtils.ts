import { format, fromUnixTime, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const toEpoch = (date: Date | string | number): number => {
  if (typeof date === 'number') return date;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return Math.floor(dateObj.getTime() / 1000);
};

export const fromEpoch = (epoch: number | string | null): Date | null => {
  if (!epoch) return null;
  const epochNumber = typeof epoch === 'string' ? parseInt(epoch, 10) : epoch;
  if (isNaN(epochNumber)) return null;
  return fromUnixTime(epochNumber);
};

export const formatDate = (epoch: number | string | null): string => {
  const date = fromEpoch(epoch);
  if (!date) return 'Fecha no disponible';
  return format(date, 'dd/MM/yyyy hh:mm:ss a', { locale: es });
};

export const formatDateOnly = (epoch: number | string | null): string => {
  const date = fromEpoch(epoch);
  if (!date) return 'Fecha no disponible';
  return format(date, 'dd/MM/yyyy', { locale: es });
};

export const formatTime = (epoch: number | string | null): string => {
  const date = fromEpoch(epoch);
  if (!date) return '--:--';
  return format(date, 'hh:mm a', { locale: es });
};

export const getCurrentEpoch = (): number => {
  return Math.floor(Date.now() / 1000);
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const timestamp = typeof date === 'string' ? parseInt(date, 10) : date;
  return !isNaN(timestamp) && timestamp > 0;
};

export const formatInactivityTime = (lastActivityEpoch: number | null): string => {
  if (!lastActivityEpoch) return 'Sin actividad registrada';
  
  const lastActivity = fromUnixTime(lastActivityEpoch);
  const now = new Date();
  const hoursInactive = differenceInHours(now, lastActivity);
  
  // Si la última actividad fue hace menos de 1 hora
  if (hoursInactive < 1) {
    return 'Activo (última hora)';
  }
  // Si la última actividad fue hace menos de 10 horas
  else if (hoursInactive < 10) {
    return `Activo (hace ${hoursInactive}h)`;
  }
  // Si la última actividad fue hace más de 10 horas
  else {
    const days = Math.floor(hoursInactive / 24);
    const remainingHours = hoursInactive % 24;
    
    if (days === 0) {
      return `Inactivo hace: ${hoursInactive}h`;
    }
    else if (days === 1) {
      return `Inactivo: 1 día ${remainingHours}h`;
    }
    return `Inactivo: ${days} días ${remainingHours}h`;
  }
};