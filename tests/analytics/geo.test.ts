import { describe, it, expect } from 'vitest';
import { getGeoInfo } from '@/lib/analytics/geo';

function H(map: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(map)) h.set(k, v);
  return h;
}

describe('getGeoInfo', () => {
  it('uses x-vercel-ip-country when present', () => {
    const info = getGeoInfo(H({ 'x-vercel-ip-country': 'IN' }));
    expect(info.countryCode).toBe('IN');
    expect(info.countryName).toBe('India');
  });

  it('skips Vercel header when it is the unknown sentinel "XX"', () => {
    const info = getGeoInfo(
      H({ 'x-vercel-ip-country': 'XX', 'cf-ipcountry': 'IN' }),
    );
    expect(info.countryCode).toBe('IN');
  });

  it('falls back to cf-ipcountry when Vercel header is absent', () => {
    const info = getGeoInfo(H({ 'cf-ipcountry': 'GB' }));
    expect(info.countryCode).toBe('GB');
    expect(info.countryName).toBe('United Kingdom');
  });

  it('falls back to x-country-code from a custom proxy', () => {
    const info = getGeoInfo(H({ 'x-country-code': 'IN' }));
    expect(info.countryCode).toBe('IN');
  });

  it('parses a region tag from accept-language as last resort (NEW-004)', () => {
    // The most common case: an Indian user behind a proxy that strips geo
    // headers should still get INR pricing instead of defaulting to USD.
    const info = getGeoInfo(H({ 'accept-language': 'en-IN,en;q=0.9,hi;q=0.8' }));
    expect(info.countryCode).toBe('IN');
  });

  it('also matches multi-letter language tags like zh-HK', () => {
    const info = getGeoInfo(H({ 'accept-language': 'zh-HK,zh;q=0.9' }));
    expect(info.countryCode).toBe('HK');
  });

  it('returns XX when no usable signal is present', () => {
    const info = getGeoInfo(H({}));
    expect(info.countryCode).toBe('XX');
  });

  it('returns XX when accept-language has no region tag', () => {
    const info = getGeoInfo(H({ 'accept-language': 'en' }));
    expect(info.countryCode).toBe('XX');
  });
});
