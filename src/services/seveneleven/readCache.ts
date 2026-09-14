/** 공개 상품·매장 조회를 REST와 MCP에서 함께 재사용합니다. 재고는 저장하지 않습니다. */
import { SEVENELEVEN_API } from './api.js';
import type { SevenElevenApiEnvelope } from './types.js';

const MAX_ENTRIES = 128;
const TTL_BY_PATH = new Map<string, number>([
  [SEVENELEVEN_API.SEARCH_GOODS_PATH, 5 * 60_000],
  [SEVENELEVEN_API.SEARCH_STORE_PATH, 30 * 60_000],
  [SEVENELEVEN_API.SEARCH_POPWORD_PATH, 5 * 60_000],
  [SEVENELEVEN_API.PRODUCT_PAGES_PATH, 5 * 60_000],
  [SEVENELEVEN_API.PRODUCT_ISSUES_PATH, 5 * 60_000],
  [SEVENELEVEN_API.EXHIBITION_MAIN_PATH, 5 * 60_000],
]);
const values = new Map<string, { expiresAt: number; value: SevenElevenApiEnvelope<unknown> }>();
const pending = new Map<string, Promise<SevenElevenApiEnvelope<unknown>>>();

export function clearSevenElevenReadCache(): void {
  values.clear();
  pending.clear();
}

export async function withSevenElevenReadCache<T>(
  path: string,
  body: unknown,
  timeout: number | undefined,
  request: () => Promise<SevenElevenApiEnvelope<T>>,
): Promise<SevenElevenApiEnvelope<T>> {
  const ttl = TTL_BY_PATH.get(path.split('?')[0]);
  if (!ttl) return request();
  const key = JSON.stringify([path, body, timeout]);
  const cached = values.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return structuredClone(cached.value) as SevenElevenApiEnvelope<T>;
  }
  values.delete(key);
  const existing = pending.get(key);
  if (existing) return structuredClone(await existing) as SevenElevenApiEnvelope<T>;
  // 부하가 높아져도 진행 중인 조회 키를 무제한으로 보관하지 않습니다.
  if (pending.size >= MAX_ENTRIES) return request();
  const promise = request().then((value) => {
    if (value.success === true && value.data !== undefined) {
      if (values.size >= MAX_ENTRIES) values.delete(values.keys().next().value!);
      values.set(key, { expiresAt: Date.now() + ttl, value: structuredClone(value) });
    }
    return value;
  });
  pending.set(key, promise);
  try {
    return structuredClone(await promise);
  } finally {
    pending.delete(key);
  }
}
