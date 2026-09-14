import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64, decodeZyteHttpBody, requestByZyte } from '../../src/utils/zyte.js';

const mockFetch = vi.fn();
const policyMessage = 'Zyte 유료 호출은 비용 정책에 따라 비활성화되어 있습니다.';

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ statusCode: 200 })));
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('requestByZyte 비용 정책', () => {
  it('명시적인 키가 있어도 유료 요청을 보내지 않는다', async () => {
    await expect(requestByZyte({ apiKey: 'test-key', url: 'https://example.com' })).rejects.toThrow(
      policyMessage,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('환경 변수에 키가 남아 있어도 유료 요청을 보내지 않는다', async () => {
    vi.stubEnv('ZYTE_API_KEY', 'test-env-key');
    await expect(requestByZyte({ url: 'https://example.com' })).rejects.toThrow(policyMessage);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('키가 없어도 설정 안내 대신 비용 정책을 알린다', async () => {
    vi.stubEnv('ZYTE_API_KEY', undefined);
    await expect(requestByZyte({ url: 'https://example.com' })).rejects.toThrow(policyMessage);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('키를 조회하기 전에 요청을 차단한다', async () => {
    const readKey = vi.fn(() => {
      throw new Error('키에 접근했습니다');
    });
    await expect(
      requestByZyte({
        url: 'https://example.com',
        get apiKey() {
          return readKey();
        },
      }),
    ).rejects.toThrow(policyMessage);
    expect(readKey).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('동시 요청과 재시도 설정도 유료 요청을 만들지 않는다', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        requestByZyte({
          apiKey: 'test-key',
          url: 'https://example.com',
          retries: 100,
          retryDelayMs: 0,
        }),
      ),
    );
    for (const result of results) {
      expect(result).toMatchObject({ status: 'rejected', reason: new Error(policyMessage) });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('기존 응답 디코딩 호환성', () => {
  it('UTF-8 본문을 디코딩한다', () => {
    const encoded = Buffer.from(JSON.stringify({ name: '커피' })).toString('base64');
    expect(decodeBase64(encoded)).toBe('{"name":"커피"}');
    expect(decodeZyteHttpBody({ httpResponseBody: encoded })).toEqual({ name: '커피' });
  });

  it('본문 누락은 명확한 오류를 반환한다', () => {
    expect(() => decodeZyteHttpBody({})).toThrow('Zyte HTTP 응답 본문이 비어 있습니다.');
  });

  it('atob가 없으면 Buffer를 사용한다', () => {
    vi.stubGlobal('atob', undefined);
    expect(decodeBase64('e30=')).toBe('{}');
  });

  it('디코딩 수단이 없으면 오류를 반환한다', () => {
    vi.stubGlobal('atob', undefined);
    vi.stubGlobal('Buffer', undefined);
    expect(() => decodeBase64('e30=')).toThrow('Base64 디코딩을 지원하지 않는 런타임입니다.');
  });
});
