import { expect, it, vi } from 'vitest';
import { createBrowserRunner } from '../../scripts/relay/browser.js';
it('성공 JSON만 반환하고 브라우저 fetch에 제한시간을 설정한다', async () => {
  const page = { evaluate: vi.fn().mockResolvedValue({ status: 200, body: { status: 'SUCCESS' } }) };
  const run = createBrowserRunner(page);
  expect(await run('/oystore/api/stock/stock-goods-info-v3', { goodsNo: 'A1' })).toEqual({ status: 'SUCCESS' });
  expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: 15000 }));
  for (const response of [{status: 403, body: {}}, {status: 200, body: null}, {status: 200, body: {status:'FAIL'}}]) {
    page.evaluate.mockResolvedValue(response);
    await expect(run('/path', {})).rejects.toThrow('올리브영 브라우저 응답 실패');
  }
});
it('브라우저 컨텍스트에서 JSON 요청과 응답을 처리하고 HTML은 거절한다', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({status:'SUCCESS'}));
  vi.stubGlobal('fetch', fetch);
  const page = { evaluate: vi.fn().mockImplementation((fn, args) => fn(args)) };
  const run = createBrowserRunner(page);
  try {
    expect(await run('/oystore/api/stock/stock-goods-info-v3', {goodsNo:'A1'})).toEqual({status:'SUCCESS'});
    expect(fetch).toHaveBeenCalledWith('https://www.oliveyoung.co.kr/oystore/api/stock/stock-goods-info-v3', expect.objectContaining({method:'POST',credentials:'include',body:'{"goodsNo":"A1"}',signal:expect.any(AbortSignal)}));
    fetch.mockResolvedValue(new Response('<html>challenge</html>'));
    await expect(run('/p', {})).rejects.toThrow('브라우저 응답 실패');
    fetch.mockRejectedValue(new Error('network'));
    await expect(run('/p', {})).rejects.toThrow('network');
  } finally { vi.unstubAllGlobals(); }
});
