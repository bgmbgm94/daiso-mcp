/** 개인 프로필과 분리된 브라우저의 동일 출처 조회. */
import type { Page } from 'playwright';
import type { BrowserRunner } from './oliveyoung.js';
export function createBrowserRunner(page: Pick<Page, 'evaluate'>): BrowserRunner {
  return async (path, body) => {
    const result = await page.evaluate(
      async ({ path, body, timeout }) => {
        const response = await fetch(`https://www.oliveyoung.co.kr${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeout),
        });
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Browser response body missing');
        const decoder = new TextDecoder();
        let bytes = 0;
        let text = '';
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new Error('Browser response size limit');
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* 보안 검증 HTML을 정상 데이터로 반환하지 않습니다. */
        }
        return { status: response.status, body: parsed };
      },
      { path, body, timeout: 15000 },
    );
    if (result.status !== 200 || result.body?.status !== 'SUCCESS')
      throw new Error('올리브영 브라우저 응답 실패');
    return result.body;
  };
}
