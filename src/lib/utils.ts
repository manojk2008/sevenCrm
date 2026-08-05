import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
} from "./format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
