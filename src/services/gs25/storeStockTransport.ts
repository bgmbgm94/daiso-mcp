/**
 * GS25 재고 원본 요청과 Zyte 대체 경로
 */

import { fetchJson, HttpError } from '../../utils/http.js';
import { Gs25UpstreamUnavailableError } from './errors.js';
import type { Gs25StoreStockResponse } from './types.js';

interface StoreStockTransportOptions {
  timeout?: number;
  zyteApiKey?: string;
  apiKey?: string;
}

function withApiKey(headers: Record<string, string>, apiKey?: string): Record<string, string> {
  const normalizedApiKey = apiKey?.trim();
  return normalizedApiKey ? { ...headers, 'Api-Key': normalizedApiKey } : headers;
}

function isAuthenticationStatus(status?: number): boolean {
  return status === 401 || status === 403;
}

export async function fetchGs25StoreStockResponse(
  url: string,
  options: StoreStockTransportOptions,
  headers: Record<string, string>,
): Promise<Gs25StoreStockResponse> {
  const requestHeaders = withApiKey(headers, options.apiKey);

  try {
    return await fetchJson<Gs25StoreStockResponse>(url, {
      method: 'GET',
      timeout: options.timeout,
      retries: 1,
      retryDelayMs: 250,
      headers: requestHeaders,
    });
  } catch (error) {
    if (!(error instanceof HttpError) || !isAuthenticationStatus(error.status)) {
      throw error;
    }

    throw new Gs25UpstreamUnavailableError();
  }
}
