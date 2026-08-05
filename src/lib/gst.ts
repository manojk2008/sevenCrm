// GSTIN structure: 2-digit state code + 10-char PAN + 1 entity code + 'Z' + 1 checksum
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "19": "West Bengal", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "27": "Maharashtra", "29": "Karnataka", "32": "Kerala",
  "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
  // add remaining state codes as needed
};

export function isValidGSTINFormat(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function getGSTINState(gstin: string): string | null {
  const code = gstin.slice(0, 2);
  return STATE_CODES[code] ?? null;
}

export function getGSTINPan(gstin: string): string {
  return gstin.slice(2, 12);
}