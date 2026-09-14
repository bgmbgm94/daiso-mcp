/**
 * 차단 응답용 Zyte JSON 폴백 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJsonWithZyteFallback } from '../../src/utils/zyteJsonFallback.js';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJsonWithZyteFallback', () => {
  it('HTML 성공 응답은 유료 재시도 없이 형식 오류를 전달한다', async () => {
    mockFetch.mockResolvedValueOnce(new Response('<!DOCTYPE html><html>page</html>'));
    await expect(
      fetchJsonWithZyteFallback('https://example.com/api', {
        zyteApiKey: 'test-key',
      }),
    ).rejects.toMatchObject({ name: 'UnexpectedHtmlResponseError' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('원본 요청이 성공하면 Zyte를 호출하지 않는다', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      fetchJsonWithZyteFallback('https://example.com/api', {
        method: 'GET',
        zyteApiKey: 'test-key',
      }),
    ).resolves.toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403, 429])('원본 %s 응답이어도 유료 요청은 보내지 않는다', async (status) => {
    mockFetch.mockResolvedValueOnce(new Response('blocked', { status }));
    await expect(
      fetchJsonWithZyteFallback('https://example.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"query":"coffee"}',
        zyteApiKey: 'test-key',
        zyteTags: { service: 'test' },
      }),
    ).rejects.toThrow('비용 정책');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('원본 500 응답은 Zyte로 재시도하지 않는다', async () => {
    mockFetch.mockResolvedValueOnce(new Response('origin error', { status: 500 }));

    await expect(
      fetchJsonWithZyteFallback('https://example.com/api', {
        zyteApiKey: 'test-key',
      }),
    ).rejects.toThrow('API 요청 실패: 500');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('HEAD 요청도 차단 응답 이후 비용 정책을 알린다', async () => {
    mockFetch.mockResolvedValueOnce(new Response('blocked', { status: 403 }));

    await expect(
      fetchJsonWithZyteFallback('https://example.com/api', {
        method: 'HEAD',
        zyteApiKey: 'test-key',
      }),
    ).rejects.toThrow('비용 정책');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
