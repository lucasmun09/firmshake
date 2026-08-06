import { describe, expect, it } from 'vitest';

import {
  buildE164PhoneNumber,
  formatNationalPhoneNumber,
  formatPhoneForDisplay,
  isValidNationalPhoneNumber,
  isValidPhoneNumber,
  nationalPhoneValidationMessage,
  normalizeNationalDigits,
  normalizePhoneNumberInput,
  parseE164PhoneNumber,
} from '@/utils/phoneNumber';

describe('phoneNumber', () => {
  it('normalizes whitespace in E.164 phone numbers', () => {
    expect(normalizePhoneNumberInput(' +1 555 555 5555 ')).toBe('+15555555555');
  });

  it('accepts valid E.164 numbers', () => {
    expect(isValidPhoneNumber('+15555555555')).toBe(true);
    expect(isValidPhoneNumber('+442071838750')).toBe(true);
  });

  it('rejects invalid E.164 numbers', () => {
    expect(isValidPhoneNumber('5555555555')).toBe(false);
    expect(isValidPhoneNumber('+0123456789')).toBe(false);
    expect(isValidPhoneNumber('')).toBe(false);
  });

  it('strips non-digits and leading zeros from national input', () => {
    expect(normalizeNationalDigits('(555) 555-5555')).toBe('5555555555');
    expect(normalizeNationalDigits('07400 123456')).toBe('7400123456');
  });

  it('validates national numbers by country', () => {
    expect(isValidNationalPhoneNumber('US', '5555555555')).toBe(true);
    expect(isValidNationalPhoneNumber('US', '555555555')).toBe(false);
    expect(isValidNationalPhoneNumber('GB', '7400123456')).toBe(true);
  });

  it('builds E.164 from country and national number', () => {
    expect(buildE164PhoneNumber('US', '(555) 555-5555')).toBe('+15555555555');
    expect(buildE164PhoneNumber('GB', '07400 123456')).toBe('+447400123456');
    expect(buildE164PhoneNumber('US', '123')).toBeNull();
  });

  it('parses E.164 back to country and national number', () => {
    expect(parseE164PhoneNumber('+15555555555')).toEqual({
      countryCode: 'US',
      nationalNumber: '5555555555',
    });
    expect(parseE164PhoneNumber('+447400123456')).toEqual({
      countryCode: 'GB',
      nationalNumber: '7400123456',
    });
    expect(parseE164PhoneNumber('5555555555')).toBeNull();
  });

  it('formats national numbers for display', () => {
    expect(formatNationalPhoneNumber('US', '5555555555')).toBe('(555) 555-5555');
    expect(formatPhoneForDisplay('+15555555555')).toBe('🇺🇸 (555) 555-5555');
  });

  it('returns country-specific validation messages', () => {
    expect(nationalPhoneValidationMessage('US')).toContain('United States');
    expect(nationalPhoneValidationMessage('US')).toContain('10 digits');
  });
});
