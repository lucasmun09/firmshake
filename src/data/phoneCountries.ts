export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
};

/** Common countries for SMS MFA; sorted by name. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'AR', name: 'Argentina', dialCode: '54', flag: '🇦🇷', minDigits: 10, maxDigits: 10, placeholder: '11 2345 6789' },
  { code: 'AU', name: 'Australia', dialCode: '61', flag: '🇦🇺', minDigits: 9, maxDigits: 9, placeholder: '412 345 678' },
  { code: 'AT', name: 'Austria', dialCode: '43', flag: '🇦🇹', minDigits: 10, maxDigits: 13, placeholder: '664 1234567' },
  { code: 'BE', name: 'Belgium', dialCode: '32', flag: '🇧🇪', minDigits: 9, maxDigits: 9, placeholder: '470 12 34 56' },
  { code: 'BR', name: 'Brazil', dialCode: '55', flag: '🇧🇷', minDigits: 10, maxDigits: 11, placeholder: '11 91234 5678' },
  { code: 'CA', name: 'Canada', dialCode: '1', flag: '🇨🇦', minDigits: 10, maxDigits: 10, placeholder: '(555) 555-5555' },
  { code: 'CL', name: 'Chile', dialCode: '56', flag: '🇨🇱', minDigits: 9, maxDigits: 9, placeholder: '9 1234 5678' },
  { code: 'CO', name: 'Colombia', dialCode: '57', flag: '🇨🇴', minDigits: 10, maxDigits: 10, placeholder: '321 1234567' },
  { code: 'DK', name: 'Denmark', dialCode: '45', flag: '🇩🇰', minDigits: 8, maxDigits: 8, placeholder: '12 34 56 78' },
  { code: 'FI', name: 'Finland', dialCode: '358', flag: '🇫🇮', minDigits: 9, maxDigits: 10, placeholder: '41 2345678' },
  { code: 'FR', name: 'France', dialCode: '33', flag: '🇫🇷', minDigits: 9, maxDigits: 9, placeholder: '6 12 34 56 78' },
  { code: 'DE', name: 'Germany', dialCode: '49', flag: '🇩🇪', minDigits: 10, maxDigits: 11, placeholder: '151 23456789' },
  { code: 'HK', name: 'Hong Kong', dialCode: '852', flag: '🇭🇰', minDigits: 8, maxDigits: 8, placeholder: '9123 4567' },
  { code: 'IN', name: 'India', dialCode: '91', flag: '🇮🇳', minDigits: 10, maxDigits: 10, placeholder: '98765 43210' },
  { code: 'IE', name: 'Ireland', dialCode: '353', flag: '🇮🇪', minDigits: 9, maxDigits: 9, placeholder: '85 123 4567' },
  { code: 'IL', name: 'Israel', dialCode: '972', flag: '🇮🇱', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567' },
  { code: 'IT', name: 'Italy', dialCode: '39', flag: '🇮🇹', minDigits: 9, maxDigits: 10, placeholder: '312 345 6789' },
  { code: 'JP', name: 'Japan', dialCode: '81', flag: '🇯🇵', minDigits: 10, maxDigits: 10, placeholder: '90 1234 5678' },
  { code: 'MX', name: 'Mexico', dialCode: '52', flag: '🇲🇽', minDigits: 10, maxDigits: 10, placeholder: '55 1234 5678' },
  { code: 'NL', name: 'Netherlands', dialCode: '31', flag: '🇳🇱', minDigits: 9, maxDigits: 9, placeholder: '6 12345678' },
  { code: 'NZ', name: 'New Zealand', dialCode: '64', flag: '🇳🇿', minDigits: 8, maxDigits: 10, placeholder: '21 123 4567' },
  { code: 'NG', name: 'Nigeria', dialCode: '234', flag: '🇳🇬', minDigits: 10, maxDigits: 10, placeholder: '802 123 4567' },
  { code: 'NO', name: 'Norway', dialCode: '47', flag: '🇳🇴', minDigits: 8, maxDigits: 8, placeholder: '412 34 567' },
  { code: 'PH', name: 'Philippines', dialCode: '63', flag: '🇵🇭', minDigits: 10, maxDigits: 10, placeholder: '917 123 4567' },
  { code: 'PL', name: 'Poland', dialCode: '48', flag: '🇵🇱', minDigits: 9, maxDigits: 9, placeholder: '512 345 678' },
  { code: 'PT', name: 'Portugal', dialCode: '351', flag: '🇵🇹', minDigits: 9, maxDigits: 9, placeholder: '912 345 678' },
  { code: 'SG', name: 'Singapore', dialCode: '65', flag: '🇸🇬', minDigits: 8, maxDigits: 8, placeholder: '9123 4567' },
  { code: 'ZA', name: 'South Africa', dialCode: '27', flag: '🇿🇦', minDigits: 9, maxDigits: 9, placeholder: '82 123 4567' },
  { code: 'KR', name: 'South Korea', dialCode: '82', flag: '🇰🇷', minDigits: 9, maxDigits: 10, placeholder: '10 1234 5678' },
  { code: 'ES', name: 'Spain', dialCode: '34', flag: '🇪🇸', minDigits: 9, maxDigits: 9, placeholder: '612 34 56 78' },
  { code: 'SE', name: 'Sweden', dialCode: '46', flag: '🇸🇪', minDigits: 9, maxDigits: 10, placeholder: '70 123 45 67' },
  { code: 'CH', name: 'Switzerland', dialCode: '41', flag: '🇨🇭', minDigits: 9, maxDigits: 9, placeholder: '78 123 45 67' },
  { code: 'TW', name: 'Taiwan', dialCode: '886', flag: '🇹🇼', minDigits: 9, maxDigits: 9, placeholder: '912 345 678' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '971', flag: '🇦🇪', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44', flag: '🇬🇧', minDigits: 10, maxDigits: 10, placeholder: '7400 123456' },
  { code: 'US', name: 'United States', dialCode: '1', flag: '🇺🇸', minDigits: 10, maxDigits: 10, placeholder: '(555) 555-5555' },
].sort((a, b) => a.name.localeCompare(b.name));

const countriesByCode = new Map(PHONE_COUNTRIES.map((country) => [country.code, country]));

const dialCodeEntries = [...PHONE_COUNTRIES]
  .map((country) => ({ country, dialCode: country.dialCode }))
  .sort((a, b) => b.dialCode.length - a.dialCode.length);

export function getPhoneCountry(code: string): PhoneCountry | undefined {
  return countriesByCode.get(code.toUpperCase());
}

export function guessDefaultCountryCode(): string {
  if (typeof navigator !== 'undefined') {
    const region = navigator.language.split('-')[1]?.toUpperCase();
    if (region && countriesByCode.has(region)) {
      return region;
    }
  }
  return 'US';
}
