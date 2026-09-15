export interface PasswordRule {
  label: string;
  test: (password: string, email: string) => boolean;
}

// Mirrors server/utils/passwordPolicy.js so users get instant feedback; the server remains the source of truth.
export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 12 characters', test: (password) => password.length >= 12 },
  { label: 'One lowercase letter', test: (password) => /[a-z]/.test(password) },
  { label: 'One uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { label: 'One number', test: (password) => /[0-9]/.test(password) },
  { label: 'One symbol', test: (password) => /[^A-Za-z0-9]/.test(password) },
  {
    label: 'Does not contain your email',
    test: (password, email) => {
      const localPart = email.split('@')[0]?.toLowerCase();
      if (!localPart || localPart.length <= 2) return true;
      return !password.toLowerCase().includes(localPart);
    }
  }
];

export function isPasswordValid(password: string, email: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password, email));
}
