/**
 * Geolocation utility for mapping country codes to names
 * and extracting country information from request headers.
 */

// Basic mapping of country codes to human names
export const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'IN': 'India',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'JP': 'Japan',
  'CN': 'China',
  'BR': 'Brazil',
  'RU': 'Russia',
  'MX': 'Mexico',
  'ID': 'Indonesia',
  'PK': 'Pakistan',
  'NG': 'Nigeria',
  'BD': 'Bangladesh',
  'PH': 'Philippines',
  'VN': 'Vietnam',
  'ET': 'Ethiopia',
  'EG': 'Egypt',
  'IR': 'Iran',
  'TR': 'Turkey',
  'TH': 'Thailand',
  'IT': 'Italy',
  'ZA': 'South Africa',
  'ES': 'Spain',
  'CO': 'Colombia',
  'AR': 'Argentina',
  'DZ': 'Algeria',
  'SD': 'Sudan',
  'UA': 'Ukraine',
  'IQ': 'Iraq',
  'PL': 'Poland',
  'AF': 'Afghanistan',
  'MA': 'Morocco',
  'SA': 'Saudi Arabia',
  'UZ': 'Uzbekistan',
  'PE': 'Peru',
  'MY': 'Malaysia',
  'AO': 'Angola',
  'GH': 'Ghana',
  'MZ': 'Mozambique',
  'YE': 'Yemen',
  'NP': 'Nepal',
  'VE': 'Venezuela',
  'MG': 'Madagascar',
  'CM': 'Cameroon',
  'CI': 'Ivory Coast',
  'KP': 'North Korea',
  'NE': 'Niger',
  'TW': 'Taiwan',
  'LK': 'Sri Lanka',
  'BF': 'Burkina Faso',
  'ML': 'Mali',
  'RO': 'Romania',
  'MW': 'Malawi',
  'CL': 'Chile',
  'KZ': 'Kazakhstan',
  'ZM': 'Zambia',
  'GT': 'Guatemala',
  'EC': 'Ecuador',
  'SY': 'Syria',
  'SN': 'Senegal',
  'KH': 'Cambodia',
  'TD': 'Chad',
  'SO': 'Somalia',
  'ZW': 'Zimbabwe',
  'GN': 'Guinea',
  'RW': 'Rwanda',
  'BJ': 'Benin',
  'BI': 'Burundi',
  'TN': 'Tunisia',
  'SS': 'South Sudan',
  'HT': 'Haiti',
  'BE': 'Belgium',
  'CU': 'Cuba',
  'JO': 'Jordan',
  'GR': 'Greece',
  'CZ': 'Czech Republic',
  'PT': 'Portugal',
  'SE': 'Sweden',
  'AZ': 'Azerbaijan',
  'HU': 'Hungary',
  'AE': 'United Arab Emirates',
  'BY': 'Belarus',
  'IL': 'Israel',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'HK': 'Hong Kong',
  'RS': 'Serbia',
  'SG': 'Singapore',
  'DK': 'Denmark',
  'FI': 'Finland',
  'NO': 'Norway',
  'NZ': 'New Zealand',
  'IE': 'Ireland',
  'KW': 'Kuwait',
  'QA': 'Qatar',
  // Add more as needed...
};

export interface GeoInfo {
  countryCode: string;
  countryName: string;
}

/**
 * Extracts country info from common cloud provider headers, with a couple of
 * fallback signals for environments where the geo headers are stripped.
 *
 * Order:
 *   1. x-vercel-ip-country         (Vercel edge)
 *   2. cf-ipcountry                (Cloudflare)
 *   3. x-country-code              (custom proxy convention)
 *   4. accept-language region tag  (e.g. "en-IN", "hi-IN" → IN). Weakest
 *      signal — browser language is often "en-US" regardless of location —
 *      but a regional tag is far better than defaulting to "XX/Unknown" and
 *      forcing every Indian user onto USD pricing (NEW-004).
 */
export function getGeoInfo(headers: Headers): GeoInfo {
  // Vercel
  const vercelCountry = headers.get('x-vercel-ip-country');
  if (vercelCountry && vercelCountry !== 'XX') {
    return {
      countryCode: vercelCountry.toUpperCase(),
      countryName: COUNTRY_NAMES[vercelCountry.toUpperCase()] || 'Unknown Country'
    };
  }

  // Cloudflare
  const cfCountry = headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return {
      countryCode: cfCountry.toUpperCase(),
      countryName: COUNTRY_NAMES[cfCountry.toUpperCase()] || 'Unknown Country'
    };
  }

  // Custom proxy / nginx
  const proxyCountry = headers.get('x-country-code');
  if (proxyCountry && proxyCountry !== 'XX') {
    return {
      countryCode: proxyCountry.toUpperCase(),
      countryName: COUNTRY_NAMES[proxyCountry.toUpperCase()] || 'Unknown Country'
    };
  }

  // Last-resort: parse a region tag out of Accept-Language. Best-effort only.
  const acceptLanguage = headers.get('accept-language');
  if (acceptLanguage) {
    const regionMatch = acceptLanguage.match(/[a-z]{2,3}-([A-Z]{2})\b/);
    if (regionMatch) {
      const code = regionMatch[1].toUpperCase();
      if (COUNTRY_NAMES[code]) {
        return {
          countryCode: code,
          countryName: COUNTRY_NAMES[code]
        };
      }
    }
  }

  // Fallback for local dev or missing headers
  return {
    countryCode: 'XX',
    countryName: 'Unknown'
  };
}
