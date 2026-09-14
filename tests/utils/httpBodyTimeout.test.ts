import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchText, fetchWithTimeout } from '../../src/utils/http.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('응답 본문 제한 시간', () => {
  it.each([200, 404])('본문 읽기 실패는 추가 요청을 만들지 않는다 (%s)', async (status) => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('body disconnected'));
            },
          }),
          { status },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchText('https://example.com', { retries: 1, retryDelayMs: 0 })).rejects.toThrow(
      'body disconnected',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['{broken', '<html>error</html>'])('본문 해석 실패는 재시도하지 않는다', async (body) => {
    const fetchMock = vi.fn(async () => new Response(body));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchJson('https://example.com', { retries: 1, retryDelayMs: 0 }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetchWithTimeout은 읽지 않은 스트림 응답을 그대로 반환한다', async () => {
    const response = new Response(new ReadableStream());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    await expect(fetchWithTimeout('https://example.com')).resolves.toBe(response);
    expect(response.bodyUsed).toBe(false);
    await response.body?.cancel();
  });

  it.each([fetchJson, fetchText])('헤더를 받은 뒤 멈춘 본문도 중단한다', async (read) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                init.signal.addEventListener('abort', () =>
                  controller.error(new DOMException('aborted', 'AbortError')),
                );
              },
            }),
          ),
      ),
    );
    const result = read('https://example.com', { timeout: 10 });
    let settled = false;
    const observed = result.then(
      () => {
        settled = true;
        expect.unreachable('본문 제한 시간이 누락됐습니다');
      },
      (error) => {
        settled = true;
        expect(error.name).toBe('AbortError');
      },
    );
    await vi.advanceTimersByTimeAsync(11);
    expect(settled).toBe(true);
    await observed;
  });
});
