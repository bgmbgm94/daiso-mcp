/** 고정된 올리브영 조회만 허용하는 인증 릴레이. */
import { timingSafeEqual } from 'node:crypto';
import { OLIVEYOUNG_API } from '../../src/services/oliveyoung/api.js';
import type { OliveyoungApiResponse } from '../../src/services/oliveyoung/types.js';
export type BrowserRunner = (
  path: string,
  body: Record<string, unknown>,
) => Promise<OliveyoungApiResponse>;
const paths: Record<string, string> = {
  'find-store': OLIVEYOUNG_API.STORE_FINDER_PATH,
  'product-search-v3': OLIVEYOUNG_API.PRODUCT_SEARCH_PATH,
  'stock-goods-info-v3': OLIVEYOUNG_API.STOCK_GOODS_INFO_PATH,
  'stock-stores': OLIVEYOUNG_API.STOCK_STORES_PATH,
};
const fields: Record<string, Record<string, 'string' | 'number' | 'boolean'>> = {
  'find-store': {
    lat: 'number',
    lon: 'number',
    pageIdx: 'number',
    searchWords: 'string',
    pogKeys: 'string',
    serviceKeys: 'string',
    mapLat: 'number',
    mapLon: 'number',
  },
  'product-search-v3': {
    includeSoldOut: 'boolean',
    keyword: 'string',
    page: 'number',
    sort: 'string',
    size: 'number',
  },
  'stock-goods-info-v3': { goodsNo: 'string' },
  'stock-stores': {
    productId: 'string',
    lat: 'number',
    lon: 'number',
    pageIdx: 'number',
    searchWords: 'string',
    mapLat: 'number',
    mapLon: 'number',
  },
};
const error = (status: number, message: string) => Response.json({ error: message }, { status });

interface RelayOptions {
  takeQuota?: () => Promise<boolean>;
  status?: () => Record<string, unknown>;
}
export function createOliveyoungRelay(
  token: string,
  run: BrowserRunner,
  options: RelayOptions = {},
) {
  if (!token.trim()) throw new Error('OY_RELAY_TOKEN이 필요합니다.');
  const expected = Buffer.from(`Bearer ${token}`);
  let outstanding = 0;
  let tail: Promise<unknown> = Promise.resolve();
  return async (request: Request): Promise<Response> => {
    const provided = Buffer.from(request.headers.get('authorization') || '');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return error(401, 'Unauthorized');
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health' && !url.search && options.status) {
      return Response.json({ ...options.status(), outstanding });
    }
    if (!url.pathname.startsWith('/v1/oliveyoung/')) return error(404, 'Not found');
    const operation = url.pathname.slice('/v1/oliveyoung/'.length);
    if (request.method !== 'POST' || url.search || !Object.hasOwn(paths, operation))
      return error(404, 'Not found');
    // 느린 업로드도 슬롯을 점유하므로 본문 읽기 전에 상한을 검사합니다.
    if (outstanding >= 8) return error(503, 'Relay busy');
    outstanding++;
    try {
      let body: Record<string, unknown>;
      try {
        const reader = request.body?.getReader();
        if (!reader) return error(400, 'JSON body required');
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 16384) {
            await reader.cancel();
            return error(413, 'Body too large');
          }
          chunks.push(next.value);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const schema = fields[operation];
        if (
          !body ||
          Array.isArray(body) ||
          typeof body !== 'object' ||
          Object.keys(body).some((key) => !Object.hasOwn(schema, key)) ||
          Object.entries(schema).some(
            ([key, type]) =>
              typeof body[key] !== type || (type === 'number' && !Number.isFinite(body[key])),
          )
        )
          return error(400, 'Invalid payload');
      } catch {
        return error(400, 'Invalid JSON');
      }

      const queuedAt = Date.now();
      const task = tail.then(async () => {
        if (request.signal.aborted || Date.now() - queuedAt >= 15000) return null;
        if (options.takeQuota) {
          try {
            if (!(await options.takeQuota())) return 'quota' as const;
          } catch {
            return 'unavailable' as const;
          }
        }
        return run(paths[operation], body);
      });
      tail = task.catch(() => undefined);
      try {
        const result = await task;
        if (result === null) return error(503, 'Request expired');
        if (result === 'quota') return error(429, 'Relay quota exceeded');
        if (result === 'unavailable') return error(503, 'Relay quota unavailable');
        if (result?.status !== 'SUCCESS') return error(502, 'Upstream unavailable');
        return Response.json(result);
      } catch {
        return error(502, 'Upstream unavailable');
      }
    } finally {
      outstanding--;
    }
  };
}
