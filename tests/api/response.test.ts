/**
 * API 공통 응답 유틸리티 테스트
 */

import { describe, expect, it, vi } from 'vitest';
import { errorResponse } from '../../src/api/response.js';
import type { ApiContext } from '../../src/api/response.js';
import { toStandardErrorDiagnostics } from '../../src/core/errors.js';

function createJsonContext() {
  return {
    json: vi.fn((body: unknown, status?: number) => ({ body, status })),
  } as unknown as ApiContext & { json: ReturnType<typeof vi.fn> };
}

describe('errorResponse', () => {
  it('기존 error 필드를 유지하면서 표준 진단 정보를 함께 반환한다', () => {
    const ctx = createJsonContext();

    errorResponse(ctx, 'GS25_PRODUCT_SEARCH_FAILED', 'upstream failed', 500);

    expect(ctx.json).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'GS25_PRODUCT_SEARCH_FAILED',
          message: 'upstream failed',
        },
        diagnostics: {
          code: 'GS25_PRODUCT_SEARCH_FAILED',
          message: 'upstream failed',
          status: 500,
          retryable: true,
          service: 'gs25',
          operation: 'product_search',
          upstreamStatus: undefined,
          hint: '일시적인 외부 서비스 오류일 수 있습니다. 잠시 후 다시 시도하세요.',
        },
      },
      500,
    );
  });

  it('서비스/작업을 추론할 수 없으면 operation을 생략한다', () => {
    expect(toStandardErrorDiagnostics('FAILED', 'failed')).toEqual(
      expect.objectContaining({
        code: 'FAILED',
        message: 'failed',
        operation: undefined,
        service: undefined,
        retryable: true,
      }),
    );
  });

  it('빈 에러 코드는 서비스와 작업을 추론하지 않는다', () => {
    expect(toStandardErrorDiagnostics('', 'failed')).toEqual(
      expect.objectContaining({
        code: '',
        operation: undefined,
        service: undefined,
      }),
    );
  });
});

describe('설정 오류 진단', () => {
  it.each([
    'Zyte API 호출 실패: 403 Your account has been suspended.',
    'Zyte API 호출 실패: 403 account suspended',
    'ZYTE_API_KEY가 설정되지 않았습니다. .env 또는 Cloudflare Worker Secret을 확인해주세요.',
  ])('설정 오류는 재시도 대신 운영자 조치를 안내한다: %s', (message) => {
    const result = toStandardErrorDiagnostics('GS25_PRODUCT_SEARCH_FAILED', message, {
      status: 500,
    });
    expect(result).toMatchObject({ message, status: 500, retryable: false });
    expect(result.hint).toContain('운영자');
    expect(result.hint).toContain('ZYTE_API_KEY');
    expect(result.hint).toContain('계정');
  });

  it.each([
    ['GS25_PRODUCT_SEARCH_FAILED', 'Zyte API 호출 실패: 403 Forbidden', 500, 403],
    ['GS25_PRODUCT_SEARCH_FAILED', 'upstream account suspended', 500, 403],
    ['GS25_PRODUCT_SEARCH_FAILED', 'Zyte API 호출 실패: 503 unavailable', 503, undefined],
    ['GS25_PRODUCT_SEARCH_FAILED', 'rate limited', 429, undefined],
    ['GS25_TIMEOUT', 'timeout', undefined, undefined],
    ['GS25_TIMEOUT', 'timeout', 408, undefined],
  ])('일반 외부 오류는 재시도 판단을 유지한다: %s %s', (code, message, status, upstreamStatus) => {
    expect(toStandardErrorDiagnostics(code, message, { status, upstreamStatus })).toMatchObject({
      retryable: true,
      hint: '일시적인 외부 서비스 오류일 수 있습니다. 잠시 후 다시 시도하세요.',
    });
  });
});
