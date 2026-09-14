import { clearSevenElevenReadCache } from '../../../../src/services/seveneleven/readCache.js';
/**
 * 세븐일레븐 카탈로그 스냅샷 도구 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGetCatalogSnapshotTool } from '../../../../src/services/seveneleven/tools/getCatalogSnapshot.js';

const mockFetch = vi.fn();

beforeEach(() => {
  clearSevenElevenReadCache();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createGetCatalogSnapshotTool', () => {
  it('올바른 도구 정의를 반환한다', () => {
    const tool = createGetCatalogSnapshotTool();

    expect(tool.name).toBe('seveneleven_get_catalog_snapshot');
    expect(tool.metadata.title).toBe('세븐일레븐 카탈로그 스냅샷');
  });

  it('카탈로그/이슈/기획전 데이터를 반환한다', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              content: [
                {
                  prdNo: '1',
                  itemCd: '111',
                  itemOnm: '상품A',
                  onlinePrice: 1000,
                  onlineCost: 1200,
                },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              content: [
                {
                  prdNo: '2',
                  itemCd: '222',
                  itemOnm: '이슈상품',
                  onlinePrice: 2000,
                  onlineCost: 2500,
                },
              ],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                exhibitionIdx: 10,
                exhibitionName: '3월 신상품전',
                exhibitionStartDate: '2026-03-01',
                exhibitionEndDate: '2026-03-31',
                exhibitionProductList: [{}, {}],
              },
            ],
          }),
        ),
      );

    const tool = createGetCatalogSnapshotTool();
    const result = await tool.handler({ limit: 10 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.pages.totalCount).toBe(1);
    expect(parsed.issues.totalCount).toBe(1);
    expect(parsed.exhibitions.totalCount).toBe(1);
    expect(parsed.exhibitions.items[0].productCount).toBe(2);
  });

  it('키가 있어도 카탈로그 차단 시 유료 호출 없이 빈 결과를 반환한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response('blocked', { status: 403 }));
    const result = await createGetCatalogSnapshotTool('worker-key').handler({
      includeIssues: false,
      includeExhibition: false,
    });
    expect(JSON.parse(result.content[0].text).pages.totalCount).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
