import { expect, it, vi } from 'vitest';
import { createOliveyoungRelay } from '../../scripts/relay/oliveyoung.js';
const payload = { goodsNo: 'A1' };
const request = (path = 'stock-goods-info-v3', body = JSON.stringify(payload), token = 'test') => new Request(`http://localhost/v1/oliveyoung/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
it('인증 실패 시 브라우저를 호출하지 않는다', async () => {
  const runner = vi.fn(); const relay = createOliveyoungRelay('test', runner);
  expect((await relay(request(undefined, undefined, 'bad'))).status).toBe(401);
  expect(runner).not.toHaveBeenCalled();
});
it('허용된 경로와 검증한 JSON만 브라우저로 전달한다', async () => {
  const result = { status: 'SUCCESS', data: { goodsInfo: {} } };
  const runner = vi.fn().mockResolvedValue(result); const relay = createOliveyoungRelay('test', runner);
  expect(await (await relay(request())).json()).toEqual(result);
  expect(runner).toHaveBeenCalledWith('/oystore/api/stock/stock-goods-info-v3', payload);
  expect((await relay(request('https://evil.example'))).status).toBe(404);
  expect((await relay(request(undefined, '{'))).status).toBe(400);
  expect((await relay(request(undefined, '{}'))).status).toBe(400);
  expect((await relay(request(undefined, 'x'.repeat(16385)))).status).toBe(413);
  expect(runner).toHaveBeenCalledTimes(1);
});
it('브라우저 오류를 숨기고 동시 요청을 제한한다', async () => {
  let reject!: (reason: Error) => void;
  const runner = vi.fn().mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const relay = createOliveyoungRelay('test', runner);
  const first = relay(request());
  await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1));
  const queued = Array.from({ length: 7 }, () => relay(request()));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect((await relay(request())).status).toBe(503);
  runner.mockResolvedValue({ status: 'SUCCESS' });
  reject(new Error('secret details'));
  const response = await first;
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('secret');
  expect((await Promise.all(queued)).every((item) => item.status === 200)).toBe(true);
  runner.mockResolvedValue({ status: 'SUCCESS' });
  expect((await relay(request())).status).toBe(200);
});
it('대기 중 취소된 요청은 브라우저 작업을 생략한다', async () => {
  let finish!: (value: {status: string}) => void;
  const runner = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const relay = createOliveyoungRelay('test', runner);
  const first = relay(request());
  await vi.waitFor(() => expect(runner).toHaveBeenCalledTimes(1));
  const controller = new AbortController();
  const pending = relay(new Request(request(), { signal: controller.signal }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort(); finish({status:'SUCCESS'});
  await first;
  expect((await pending).status).toBe(503);
  expect(runner).toHaveBeenCalledTimes(1);
});
it('누락 인증, 빈 토큰, 잘못된 메서드와 요청 형태를 거절한다', async () => {
  const runner = vi.fn();
  expect(() => createOliveyoungRelay(' ', runner)).toThrow('OY_RELAY_TOKEN');
  const relay = createOliveyoungRelay('test', runner);
  expect((await relay(new Request('http://localhost/v1/oliveyoung/find-store'))).status).toBe(401);
  expect((await relay(new Request('http://localhost/v1/oliveyoung/find-store', { headers: {Authorization:'Bearer test'} }))).status).toBe(404);
  expect((await relay(new Request('http://localhost/v1/oliveyoung/find-store', {method:'POST',headers:{Authorization:'Bearer test'}}))).status).toBe(400);
  for (const body of ['null', '[]', '1', '{"goodsNo":4}', '{"goodsNo":"A1","url":"https://evil.example"}', '{"lat":1e400,"lon":1,"pageIdx":1,"searchWords":"","pogKeys":"","serviceKeys":"","mapLat":1,"mapLon":1}']) {
    expect((await relay(request(body.includes('lat')?'find-store':undefined, body))).status).toBe(400);
  }
  expect((await relay(request('stock-goods-info-v3?x=1'))).status).toBe(404);
  expect(runner).not.toHaveBeenCalled();
});
it('실패 상태의 브라우저 JSON을 데이터로 전달하지 않는다', async () => {
  const relay = createOliveyoungRelay('test', vi.fn().mockResolvedValue({status:'FAIL'}));
  expect((await relay(request())).status).toBe(502);
});
