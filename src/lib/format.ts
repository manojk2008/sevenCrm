import { format, formatDistanceToNow } from 'date-fns';
import { APP_CONFIG } from '@/constants/config';

/**
 * Format a number as Indian Rupees currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(APP_CONFIG.LOCALE, {
    style: 'currency',
    currency: APP_CONFIG.CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with Indian comma grouping
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat(APP_CONFIG.LOCALE).format(num);
}

/**
 * Format a number into compact Indian format (e.g. 1.2L, 45.3K, 12.5Cr)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2)}Cr`;
  }
  if (num >= 100000) {
    return `${(num / 100000).toFixed(2)}L`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toString();
}

/**
 * Format a date object or string into standard format
 */
export function formatDate(date: string | Date | number): string {
  return format(new Date(date), APP_CONFIG.DATE_FORMAT);
}

/**
 * Format a date object or string into standard datetime format
 */
export function formatDateTime(date: string | Date | number): string {
  return format(new Date(date), APP_CONFIG.DATETIME_FORMAT);
}

/**
 * Format a date as a relative time string (e.g., '2 hours ago')
 */
export function formatRelativeTime(date: string | Date | number): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get initials from a full name (e.g., 'John Doe' -> 'JD')
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Truncate a string to a certain length
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

/**
 * Format a file size in bytes to a human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
