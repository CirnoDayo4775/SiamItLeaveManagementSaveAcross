// Common validators shared by leave forms and profile
import DOMPurify from 'dompurify';

export function isValidPhoneNumber(input: string): boolean {
  if (!/^[0-9]{9,10}$/.test(input)) return false;
  if (!input.startsWith('0')) return false;
  if (/^(\d)\1{8,9}$/.test(input)) return false;
  return true;
}

/**
 * Enhanced email validation
 * Rejects: test@.com, test@domain..com, test@-domain.com, etc.
 */
export function isValidEmail(input: string): boolean {
  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) return false;

  // Additional checks for common invalid patterns
  const [localPart, domain] = input.split('@');

  // Check local part
  if (!localPart || localPart.length === 0 || localPart.length > 64) return false;

  // Check domain
  if (!domain || domain.length === 0 || domain.length > 255) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.includes('..')) return false;

  // Check TLD (must be at least 2 characters)
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;

  return true;
}

/**
 * Password strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export interface PasswordStrengthResult {
  isStrong: boolean;
  score: 'weak' | 'medium' | 'strong';
  issues: string[];
}

export function checkPasswordStrength(password: string, t?: (key: string) => string): PasswordStrengthResult {
  const issues: string[] = [];

  // Use translation function if provided, otherwise use Thai defaults
  const getMessage = (key: string, fallback: string) => t ? t(key) : fallback;

  if (password.length < 8) {
    issues.push(getMessage('validation.password.minLength', 'ต้องมีอย่างน้อย 8 ตัวอักษร'));
  }
  if (!/[A-Z]/.test(password)) {
    issues.push(getMessage('validation.password.uppercase', 'ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว'));
  }
  if (!/[a-z]/.test(password)) {
    issues.push(getMessage('validation.password.lowercase', 'ต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว'));
  }
  if (!/[0-9]/.test(password)) {
    issues.push(getMessage('validation.password.number', 'ต้องมีตัวเลขอย่างน้อย 1 ตัว'));
  }

  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  let score: 'weak' | 'medium' | 'strong';
  if (issues.length === 0 && hasSpecialChar && password.length >= 12) {
    score = 'strong';
  } else if (issues.length <= 1) {
    score = 'medium';
  } else {
    score = 'weak';
  }

  return {
    isStrong: issues.length === 0,
    score,
    issues
  };
}

/**
 * Check if password meets minimum requirements
 */
export function isStrongPassword(password: string): boolean {
  return checkPasswordStrength(password).isStrong;
}

/**
 * Sanitize text input to prevent XSS attacks
 * Removes or escapes potentially dangerous characters
 * Uses DOMPurify for comprehensive protection
 */
export function sanitizeTextInput(input: string): string {
  if (!input) return '';

  // First pass: basic HTML entity encoding
  let sanitized = input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');

  // Second pass: use DOMPurify for additional protection
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });

  return sanitized;
}

/**
 * Sanitize HTML content while preserving safe tags
 * Use this for rich text content that needs formatting
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false
  });
}

/**
 * Sanitize name input - allows Thai, English, spaces, and common name characters
 */
export function sanitizeName(input: string): string {
  if (!input) return '';

  // Allow Thai characters, English letters, spaces, dots, and hyphens
  // Remove any other potentially dangerous characters
  let sanitized = input
    .replace(/[<>"'`\\\/\[\]{}();:=+!@#$%^&*~|]/g, '')
    .trim();

  // Additional DOMPurify pass
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });

  return sanitized;
}

/**
 * Validate and sanitize user name
 */
export function isValidName(input: string): boolean {
  if (!input || input.trim().length < 2) return false;
  if (input.length > 100) return false;

  // Check for suspicious patterns (potential XSS)
  if (/<script|javascript:|on\w+=/i.test(input)) return false;

  return true;
}
