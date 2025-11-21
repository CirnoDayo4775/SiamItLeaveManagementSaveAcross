// Common validators shared by leave forms and profile

export function isValidPhoneNumber(input: string): boolean {
  if (!/^[0-9]{9,10}$/.test(input)) return false;
  if (!input.startsWith('0')) return false;
  if (/^(\d)\1{8,9}$/.test(input)) return false;
  return true;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}


