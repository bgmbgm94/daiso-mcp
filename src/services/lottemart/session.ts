/**
 * 롯데마트 세션 쿠키 관리
 */

import { HttpError, fetchWithTimeout } from '../../utils/http.js';
import { ZYTE_COST_POLICY_MESSAGE } from '../../core/errors.js';
import { LOTTEMART_API } from './api.js';
import {
  fetchLotteMartSocketResponse,
  withLotteMartSessionCookie,
} from './socketTransport.js';

export {
  __testOnlyCreateLotteMartSocketResponse,
  __testOnlyFetchLotteMartSocketResponse,
  withLotteMartSessionCookie,
} from './socketTransport.js';

const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_TIMEOUT_MS = 5000;
let sessionCache: { expiresAt: number; cookie: string } | null = null;

function extractSessionCookie(response: Response): string {
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookieCandidates = cookieHeaders.getSetCookie
    ? cookieHeaders.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  const matched = cookieCandidates
    .flatMap((value: string) => value.split(','))
    .map((value: string) => value.trim())
    .find((value: string) => value.startsWith('ASPSESSIONID'));

  return matched ? matched.split(';')[0].trim() : '';
}

export interface LotteMartProbeAttempt {
  used: 'direct' | 'zyte';
  success: boolean;
  status: number | null;
  statusText: string | null;
  error: string | null;
  bodyPreview: string | null;
  sessionCookie: string | null;
}

function cacheSessionCookie(cookie: string): string {
  const normalized = cookie.trim();
  if (normalized.length === 0) {
    return '';
  }

  sessionCache = {
    expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    cookie: normalized,
  };

  return normalized;
}

function cacheSessionCookieFromResponse(response: Response): string {
  const cookie = extractSessionCookie(response);
  return cacheSessionCookie(cookie);
}

export async function getCachedLotteMartSessionCookie(
  _timeout: number,
  forceRefresh = false,
): Promise<string> {
  if (forceRefresh) {
    sessionCache = null;
  }

  if (sessionCache && sessionCache.expiresAt > Date.now()) {
    return sessionCache.cookie;
  }

  return '';
}

export async function getFreshLotteMartSessionCookie(timeout: number): Promise<string> {
  return getCachedLotteMartSessionCookie(timeout, true);
}

async function fetchLotteMartResponse(
  url: string,
  init: RequestInit,
  timeout: number,
  sessionCookie: string,
): Promise<Response> {
  const headers = withLotteMartSessionCookie(
    {
      Accept: 'text/html, */*; q=0.01',
      ...init.headers,
    },
    sessionCookie,
  );

  try {
    return await fetchWithTimeout(url, {
      ...init,
      timeout,
      headers,
    });
  } catch (directError) {
    const socketResponse = await fetchLotteMartSocketResponse(
      url,
      init,
      sessionCookie,
      Math.min(timeout, FALLBACK_TIMEOUT_MS),
    ).catch(() => null);
    if (socketResponse) {
      return socketResponse;
    }
    throw directError;
  }
}

function toBodyPreview(bodyText: string): string | null {
  const normalized = bodyText.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized.slice(0, 300) : null;
}

export async function probeLotteMartRequest(
  url: string,
  init: RequestInit,
  timeout: number,
  sessionCookie: string,
  zyteApiKey?: string,
): Promise<LotteMartProbeAttempt[]> {
  const attempts: LotteMartProbeAttempt[] = [];

  try {
    const response = await fetchLotteMartResponse(url, init, timeout, sessionCookie);
    const bodyText = await response.text();
    attempts.push({
      used: 'direct',
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      error: response.ok
        ? null
        : new HttpError(response.status, response.statusText, bodyText).message,
      bodyPreview: toBodyPreview(bodyText),
      sessionCookie: extractSessionCookie(response) || null,
    });
  } catch (error) {
    attempts.push({
      used: 'direct',
      success: false,
      status: null,
      statusText: null,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      bodyPreview: null,
      sessionCookie: null,
    });
  }

  if (zyteApiKey) {
    attempts.push({
      used: 'zyte',
      success: false,
      status: null,
      statusText: null,
      error: ZYTE_COST_POLICY_MESSAGE,
      bodyPreview: null,
      sessionCookie: sessionCookie || null,
    });
  }

  return attempts;
}

export async function fetchLotteMartHtml(
  url: string,
  init: RequestInit,
  timeout: number,
  sessionCookie: string,
  zyteApiKey?: string,
): Promise<string> {
  try {
    const response = await fetchLotteMartResponse(url, init, timeout, sessionCookie);
    const cachedCookie = cacheSessionCookieFromResponse(response);
    let bodyText: string;
    try {
      bodyText = await response.text();
    } catch (error) {
      if (sessionCookie.trim().length === 0 && cachedCookie.length > 0) {
        const retried = await fetchLotteMartResponse(url, init, timeout, cachedCookie);
        cacheSessionCookieFromResponse(retried);
        const retriedBodyText = await retried.text();
        if (!retried.ok) {
          throw new HttpError(retried.status, retried.statusText, retriedBodyText);
        }
        return retriedBodyText;
      }

      throw error;
    }

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, bodyText);
    }

    if (
      bodyText.trim().length === 0 &&
      sessionCookie.trim().length === 0 &&
      cachedCookie.length > 0
    ) {
      const retried = await fetchLotteMartResponse(url, init, timeout, cachedCookie);
      cacheSessionCookieFromResponse(retried);
      const retriedBodyText = await retried.text();
      if (!retried.ok) {
        throw new HttpError(retried.status, retried.statusText, retriedBodyText);
      }
      return retriedBodyText;
    }

    return bodyText;
  } catch (error) {
    if (zyteApiKey && error instanceof Error && !error.message.includes('Zyte')) {
      throw new Error(ZYTE_COST_POLICY_MESSAGE);
    }

    throw error;
  }
}

export async function fetchLotteMartPageWithSession(
  path: string,
  init: RequestInit,
  timeout: number,
  sessionCookie: string,
  zyteApiKey?: string,
): Promise<string> {
  return fetchLotteMartHtml(
    new URL(path, LOTTEMART_API.BASE_URL).toString(),
    init,
    timeout,
    sessionCookie,
    zyteApiKey,
  );
}

export function __testOnlyClearLotteMartSessionCache(): void {
  sessionCache = null;
}
