import { describe, expect, it } from 'vitest';
import { buildConfigStatus } from '../../src/api/configStatus.js';

describe('Zyte 설정 상태', () => {
  it('키 설정 여부와 비용 정책에 따른 비활성화를 구분한다', () => {
    expect(buildConfigStatus({ ZYTE_API_KEY: 'test-key' }).zyteApiKey).toEqual({
      configured: true,
      enabled: false,
      usedBy: [],
    });
  });

  it('키가 없어도 유료 호출은 비활성화되어 있다', () => {
    expect(buildConfigStatus().zyteApiKey).toEqual({
      configured: false,
      enabled: false,
      usedBy: [],
    });
  });
});
