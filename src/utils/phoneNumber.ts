import {
  getPhoneCountry,
  guessDefaultCountryCode,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '@/data/phoneCountries';

const PENDING_PHONE_KEY = 'firmshake.pendingMfaPhone';

export { PHONE_COUNTRIES, getPhoneCountry, guessDefaultCountryCode, type PhoneCountry };

export function stashPendingMfaPhone(phoneNumber: string): void {
  sessionStorage.setItem(PENDING_PHONE_KEY, phoneNumber.trim());
}

export function consumePendingMfaPhone(): string {
  const value = sessionStorage.getItem(PENDING_PHONE_KEY) ?? '';
  sessionStorage.removeItem(PENDING_PHONE_KEY);
  return value;
}

export function clearPendingMfaPhone(): void {
  sessionStorage.removeItem(PENDING_PHONE_KEY);
}

export function normalizePhoneNumberInput(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function stripNationalPrefix(digits: string): string {
  return digits.replace(/^0+/, '');
}

export function normalizeNationalDigits(value: string): string {
  return stripNationalPrefix(digitsOnly(value));
}

export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumberInput(value);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

export function isValidNationalPhoneNumber(countryCode: string, nationalNumber: string): boolean {
  const country = getPhoneCountry(countryCode);
  if (!country) {
    return false;
  }

  const digits = normalizeNationalDigits(nationalNumber);
  if (!digits) {
    return false;
  }

  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}

export function buildE164PhoneNumber(countryCode: string, nationalNumber: string): string | null {
  const country = getPhoneCountry(countryCode);
  if (!country || !isValidNationalPhoneNumber(countryCode, nationalNumber)) {
    return null;
  }

  const digits = normalizeNationalDigits(nationalNumber);
  return `+${country.dialCode}${digits}`;
}

export function parseE164PhoneNumber(
  value: string,
): { countryCode: string; nationalNumber: string } | null {
  const normalized = normalizePhoneNumberInput(value);
  if (!normalized.startsWith('+')) {
    return null;
  }

  const digits = normalized.slice(1);
  for (const entry of dialCodeEntries()) {
    if (digits.startsWith(entry.country.dialCode)) {
      const nationalDigits = digits.slice(entry.country.dialCode.length);
      if (
        nationalDigits.length >= entry.country.minDigits
        && nationalDigits.length <= entry.country.maxDigits
      ) {
        return {
          countryCode: entry.country.code,
          nationalNumber: nationalDigits,
        };
      }
    }
  }

  return null;
}

function dialCodeEntries() {
  return [...PHONE_COUNTRIES]
    .map((country) => ({ country, dialCode: country.dialCode }))
    .sort((a, b) => {
      const byLength = b.dialCode.length - a.dialCode.length;
      if (byLength !== 0) {
        return byLength;
      }

      if (a.country.code === 'US') {
        return -1;
      }
      if (b.country.code === 'US') {
        return 1;
      }

      return a.country.name.localeCompare(b.country.name);
    });
}

export function formatNationalPhoneNumber(countryCode: string, nationalNumber: string): string {
  const country = getPhoneCountry(countryCode);
  const digits = normalizeNationalDigits(nationalNumber);
  if (!country || !digits) {
    return nationalNumber.trim();
  }

  if (country.code === 'US' || country.code === 'CA') {
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }

  return digits.replace(/(\d{3,4})(?=\d)/g, '$1 ').trim();
}

export function formatPhoneForDisplay(e164: string): string {
  const parsed = parseE164PhoneNumber(e164);
  if (!parsed) {
    return e164;
  }

  const country = getPhoneCountry(parsed.countryCode);
  if (!country) {
    return e164;
  }

  const national = formatNationalPhoneNumber(parsed.countryCode, parsed.nationalNumber);
  return `${country.flag} ${national}`;
}

export function nationalPhoneValidationMessage(countryCode: string): string {
  const country = getPhoneCountry(countryCode);
  if (!country) {
    return 'Enter a valid phone number.';
  }

  if (country.minDigits === country.maxDigits) {
    return `Enter a valid ${country.name} phone number (${country.minDigits} digits).`;
  }

  return `Enter a valid ${country.name} phone number (${country.minDigits}–${country.maxDigits} digits).`;
}
