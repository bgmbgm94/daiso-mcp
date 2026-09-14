/** 디트릭스 입력·필터·외부 장애 회귀 테스트 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleDtryxGetRemainingSeats,
  handleDtryxListCinemas,
  handleDtryxListNowShowing,
} from '../../../src/api/dtryxHandlers.js';
import {
  fetchDtryxNowShowing,
  fetchDtryxPlayDates,
  fetchDtryxTimetable,
} from '../../../src/services/dtryx/client.js';
import { createGetRemainingSeatsTool } from '../../../src/services/dtryx/tools/getRemainingSeats.js';
import { createListCinemasTool } from '../../../src/services/dtryx/tools/listCinemas.js';
import { createListNowShowingTool } from '../../../src/services/dtryx/tools/listNowShowing.js';

const mockFetch = vi.fn();
const validEmpty = () => new Response(JSON.stringify({ RetCode: 'success', Recordset: [] }));
function context(query: Record<string, string> = {}) {
  return {
    req: { query: (key: string) => query[key] },
    json: (body: unknown, status = 200) => ({ body, status }),
  } as unknown as Parameters<typeof handleDtryxListCinemas>[0];
}
beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('극장 선택과 외부 장애', () => {
  it.each([
    { keyword: '모모', region: '경기' },
    { keyword: '모모', brandCode: 'etc' },
    { cinemaCode: '000067', brandCode: 'etc' },
  ])('모든 필터를 함께 적용한다: %o', async (query) => {
    mockFetch.mockImplementation(validEmpty);
    const api = (await handleDtryxGetRemainingSeats(context(query))) as unknown as {
      status: number;
    };
    const mcp = await createGetRemainingSeatsTool().handler(query);
    expect(api.status).toBe(404);
    expect(mcp.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('상영작은 극장 지정 없이 조회하지 않는다', async () => {
    mockFetch.mockImplementation(validEmpty);
    expect(await handleDtryxListNowShowing(context())).toMatchObject({ status: 404 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('상영작도 브랜드 필터를 적용한다', async () => {
    mockFetch.mockImplementation(validEmpty);
    expect(
      await handleDtryxListNowShowing(context({ keyword: '모모', brandCode: 'etc' })),
    ).toMatchObject({ status: 404 });
    expect(
      (await createListNowShowingTool().handler({ keyword: '모모', brandCode: 'etc' })).isError,
    ).toBe(true);
  });
  it('모든 극장 요청 실패는 API 503과 MCP 오류로 반환한다', async () => {
    mockFetch.mockRejectedValue(new Error('upstream down'));
    expect(await handleDtryxGetRemainingSeats(context({ region: '서울' }))).toMatchObject({
      status: 503,
      body: { success: false },
    });
    expect((await createGetRemainingSeatsTool().handler({ region: '서울' })).isError).toBe(true);
  });
  it.each([false, true])('빈 정상 회차와 일부 실패는 성공으로 유지한다: %s', async (partial) => {
    mockFetch.mockImplementation(validEmpty);
    if (partial) mockFetch.mockRejectedValueOnce(new Error('down'));
    expect(await handleDtryxGetRemainingSeats(context({ region: '서울' }))).toMatchObject({
      status: 200,
    });
    if (partial) mockFetch.mockRejectedValueOnce(new Error('down'));
    expect((await createGetRemainingSeatsTool().handler({ region: '서울' })).isError).not.toBe(
      true,
    );
  });
  it('카탈로그 외 코드와 브랜드를 직접 조회할 수 있다', async () => {
    mockFetch.mockImplementation(validEmpty);
    expect(
      await handleDtryxListNowShowing(context({ cinemaCode: '999999', brandCode: 'etc' })),
    ).toMatchObject({ status: 200 });
    expect(
      (await createGetRemainingSeatsTool().handler({ cinemaCode: '999999', brandCode: 'etc' }))
        .isError,
    ).not.toBe(true);
    expect(String(mockFetch.mock.calls[0][0])).toContain('CinemaCd=999999');
  });
});

describe('입력 검증', () => {
  it.each(['0', '-1', '201', '1.5', 'abc', 'Infinity'])(
    '잘못된 limit을 거절한다: %s',
    async (limit) => {
      for (const handler of [handleDtryxListCinemas, handleDtryxGetRemainingSeats]) {
        expect(await handler(context({ limit }))).toMatchObject({ status: 400 });
      }
      for (const tool of [createListCinemasTool(), createGetRemainingSeatsTool()]) {
        expect((await tool.handler({ limit: Number(limit) })).isError).toBe(true);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );
  it.each(['0', '-1', '60001', '1.5', 'abc'])(
    '잘못된 timeout을 거절한다: %s',
    async (timeoutMs) => {
      for (const handler of [handleDtryxListNowShowing, handleDtryxGetRemainingSeats]) {
        expect(await handler(context({ cinemaCode: '000067', timeoutMs }))).toMatchObject({
          status: 400,
        });
      }
      for (const tool of [createListNowShowingTool(), createGetRemainingSeatsTool()]) {
        expect(
          (await tool.handler({ cinemaCode: '000067', timeoutMs: Number(timeoutMs) })).isError,
        ).toBe(true);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );
  it.each(['20260230', '2026-13-01', '2026-2-01', 'tomorrow'])(
    '유효하지 않은 날짜를 거절한다: %s',
    async (playDate) => {
      expect(await handleDtryxGetRemainingSeats(context({ playDate }))).toMatchObject({
        status: 400,
      });
      expect((await createGetRemainingSeatsTool().handler({ playDate })).isError).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );
});

describe('응답 envelope 검증', () => {
  it.each([
    { RetCode: 'failed', RetMsg: 'upstream error', Recordset: [] },
    { RetCode: 'success' },
    { Recordset: [] },
    { RetCode: 'success', Recordset: {} },
    { RetCode: 'success', Recordset: [null] },
    null,
  ])('실패하거나 잘못된 응답을 빈 목록으로 처리하지 않는다: %o', async (body) => {
    mockFetch.mockImplementation(() => new Response(JSON.stringify(body)));
    for (const request of [fetchDtryxNowShowing, fetchDtryxPlayDates, fetchDtryxTimetable]) {
      await expect(request({ brandCode: 'indieart', cinemaCode: '000067' })).rejects.toThrow();
    }
  });
});
