import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge
 * This utility helps with conditional class names and prevents class conflicts
 * 
 * @param inputs - Class values to be merged
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date into a localized string representation
 * 
 * @param date - Date to format
 * @param locale - Locale to use for formatting (defaults to 'en-US')
 * @returns Formatted date string
 */
export function formatDate(date: Date, locale = 'en-US'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  return new Date(date).toLocaleDateString(locale, options)
}

/**
 * Formats a currency amount with the appropriate symbol and locale
 * 
 * @param amount - Numeric amount to format
 * @param currency - Currency code (defaults to USD)
 * @param locale - Locale to use for formatting (defaults to 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = "USD", locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Generates a random UUID
 * Useful for temporary IDs when creating new items
 * 
 * @returns Random UUID string
 */
export function generateUUID(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
  });
}

/**
 * Truncates text to a specified length and adds ellipsis
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

/**
 * Calculates percentage of a value relative to a total
 * 
 * @param value - Current value
 * @param total - Total value
 * @returns Percentage as a number (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Safely access nested object properties without throwing errors
 * 
 * @param obj - Object to access
 * @param path - Path to the property as string with dot notation
 * @param defaultValue - Default value to return if path doesn't exist
 * @returns Property value or default value
 */
export function getNestedValue(obj: any, path: string, defaultValue: any = undefined): any {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
}