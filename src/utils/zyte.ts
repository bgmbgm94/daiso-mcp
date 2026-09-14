/**
 * Zyte Extract API 공통 유틸리티
 */

import { ZYTE_COST_POLICY_MESSAGE } from '../core/errors.js';

export interface ZyteExtractResponse {
  statusCode?: number;
  httpResponseBody?: string;
  detail?: string;
  title?: string;
}

export interface ZyteExtractOptions {
  apiKey?: string;
  url: string;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Array<{ name: string; value: string }>;
  bodyText?: string;
  tags?: Record<string, string | null>;
}

export function decodeBase64(value: string): string {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /* c8 ignore start */
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('utf8');
  }
  /* c8 ignore end */

  throw new Error('Base64 디코딩을 지원하지 않는 런타임입니다.');
}

/** 키와 재시도 설정에 관계없이 유료 네트워크 경로를 차단합니다. */
export async function requestByZyte(_options: ZyteExtractOptions): Promise<never> {
  throw new Error(ZYTE_COST_POLICY_MESSAGE);
}

export function decodeZyteHttpBody<TResponse>(result: ZyteExtractResponse): TResponse {
  if (!result.httpResponseBody) {
    throw new Error('Zyte HTTP 응답 본문이 비어 있습니다.');
  }

  return JSON.parse(decodeBase64(result.httpResponseBody)) as TResponse;
}
