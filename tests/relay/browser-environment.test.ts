import { expect, it } from 'vitest';
import { browserEnvironment } from '../../scripts/relay/browser-environment.js';
it('GUI 필수 환경만 전달하고 토큰 및 임의 로더 설정을 제거한다', () => {
  expect(
    browserEnvironment(
      {
        HOME: '/dedicated',
        PATH: '/bin',
        LANG: 'ko_KR',
        LC_CTYPE: 'UTF-8',
        DISPLAY: ':0',
        OY_RELAY_TOKEN: 'secret',
        CF_ACCESS_CLIENT_SECRET: 'secret',
        NODE_OPTIONS: 'injected',
        BREAKPAD_DUMP_LOCATION: '/other',
      },
      '/owned',
    ),
  ).toEqual({
    HOME: '/dedicated',
    PATH: '/bin',
    LANG: 'ko_KR',
    LC_CTYPE: 'UTF-8',
    DISPLAY: ':0',
    BREAKPAD_DUMP_LOCATION: '/owned',
  });
});
