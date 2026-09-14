/**
 * 직접 JSON 조회와 유료 대체 경로 중지 안내
 */

import { fetchJson, HttpError, type FetchOptions } from './http.js';
import { requestByZyte } from './zyte.js';

export interface ZyteJsonFallbackOptions extends FetchOptions {
  zyteApiKey?: string;
  zyteTags?: Record<string, string | null>;
}

const ZYTE_FALLBACK_STATUSES = new Set([400, 403, 429]);
function hasZyteApiKey(apiKey?: string): boolean {
  if (apiKey?.trim()) {
    return true;
  }

  /* c8 ignore next */
  return typeof process !== 'undefined' && Boolean(process.env?.ZYTE_API_KEY?.trim());
}

export async function fetchJsonWithZyteFallback<T>(
  url: string,
  options: ZyteJsonFallbackOptions = {},
): Promise<T> {
  const { zyteApiKey, zyteTags, ...directOptions } = options;

  try {
    return await fetchJson<T>(url, directOptions);
  } catch (error) {
    if (!(error instanceof HttpError) || !ZYTE_FALLBACK_STATUSES.has(error.status)) {
      throw error;
    }
    if (!hasZyteApiKey(zyteApiKey)) {
      throw error;
    }
  }

  return requestByZyte({ apiKey: zyteApiKey, url, tags: zyteTags });
}
