import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MIN_LENGTH,
  resolveEmailForPasswordResetLink,
  validateNewPassword,
} from '@/features/auth/services/passwordReset';
import { formatPasswordResetError } from '@/features/auth/utils/authErrors';

describe('validateNewPassword', () => {
  it('requires minimum length', () => {
    expect(validateNewPassword('12345', '12345')).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  });

  it('requires matching confirmation', () => {
    expect(validateNewPassword('password1', 'password2')).toBe('Passwords do not match.');
  });

  it('accepts valid matching passwords', () => {
    expect(validateNewPassword('password1', 'password1')).toBeNull();
  });
});

describe('formatPasswordResetError', () => {
  it('maps expired reset links', () => {
    expect(formatPasswordResetError({ code: 'auth/expired-action-code' }, 'verify')).toBe(
      'This reset link has expired. Request a new one.',
    );
  });

  it('maps email mismatch on verify', () => {
    expect(formatPasswordResetError({ code: 'auth/invalid-credential' }, 'verify')).toBe(
      'That email does not match this reset link. Enter the same email address that received the link.',
    );
  });

  it('maps weak password on update', () => {
    expect(formatPasswordResetError({ code: 'auth/weak-password' }, 'update')).toBe(
      'Password must be at least 6 characters.',
    );
  });

  it('surfaces plain validation errors', () => {
    expect(formatPasswordResetError(new Error('Please enter your email address.'), 'request')).toBe(
      'Please enter your email address.',
    );
  });
});

describe('resolveEmailForPasswordResetLink', () => {
  it('prefers explicit email override', () => {
    expect(resolveEmailForPasswordResetLink('  User@Example.com ')).toBe('user@example.com');
  });

  it('returns null when no override and no stored email', () => {
    expect(resolveEmailForPasswordResetLink()).toBeNull();
  });
});
