/**
 * 올리브영 주변 매장 탐색 도구 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFindNearbyStoresTool } from '../../../../src/services/oliveyoung/tools/findNearbyStores.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createDirectResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

describe('createFindNearbyStoresTool', () => {
  it('올바른 도구 정의를 반환한다', () => {
    const tool = createFindNearbyStoresTool('test-key');

    expect(tool.name).toBe('oliveyoung_find_nearby_stores');
    expect(tool.metadata.title).toBe('올리브영 주변 매장 탐색');
  });

  it('주변 매장 목록을 반환한다', async () => {
    mockFetch.mockResolvedValue(
      createDirectResponse({
        status: 'SUCCESS',
        data: {
          totalCount: 2,
          storeList: [
            {
              storeCode: 'D176',
              storeName: '올리브영 명동 타운',
              address: '서울 중구 명동길 53',
              latitude: 37.564,
              longitude: 126.985,
              pickupYn: false,
              o2oRemainQuantity: 0,
            },
            {
              storeCode: 'D177',
              storeName: '올리브영 을지로점',
              address: '서울 중구 을지로',
              latitude: 37.565,
              longitude: 126.987,
              pickupYn: true,
              o2oRemainQuantity: 3,
            },
          ],
        },
      })
    );

    const tool = createFindNearbyStoresTool('test-key');
    const result = await tool.handler({ keyword: '명동', limit: 1 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.totalCount).toBe(2);
    expect(parsed.count).toBe(1);
    expect(parsed.stores[0].storeCode).toBe('D176');
  });

  it('직접 요청에 JSON 헤더를 포함한다', async () => {
    mockFetch.mockResolvedValue(
      createDirectResponse({
        status: 'SUCCESS',
        data: { totalCount: 0, storeList: [] },
      })
    );

    const tool = createFindNearbyStoresTool('test-key');
    await tool.handler({});

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.oliveyoung.co.kr/oystore/api/storeFinder/find-store',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});
