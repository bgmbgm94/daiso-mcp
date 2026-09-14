/** 실행 시에만 로컬 브라우저 릴레이를 시작합니다. */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { createOliveyoungRelay } from './oliveyoung.js';
import { createBrowserRunner } from './browser.js';

async function main() {
  const token = process.env.OY_RELAY_TOKEN;
  if (!token?.trim()) throw new Error('OY_RELAY_TOKEN이 필요합니다.');
  const port = Number(process.env.OY_RELAY_PORT || 4319);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('OY_RELAY_PORT 값이 잘못되었습니다.');
  const browser = await chromium.launch({ headless: false, executablePath: process.env.OY_BROWSER_EXECUTABLE });
  try {
    const context = await browser.newContext({ locale: 'ko-KR' });
    const page = await context.newPage();
    await page.goto('https://www.oliveyoung.co.kr/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForURL('**/store/**', { timeout: 30000 });
    const handler = createOliveyoungRelay(token, createBrowserRunner(page));
    const server = createServer(async (req, res) => {
      try {
        const controller = new AbortController();
        res.once('close', () => controller.abort());
        const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
          signal: controller.signal, method: req.method, headers: req.headers as Record<string, string>,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req),
          duplex: 'half',
        } as RequestInit & { duplex: 'half' });
        const response = await handler(request);
        res.writeHead(response.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(await response.text());
      } catch {
        res.writeHead(500); res.end('{"error":"Relay failure"}');
      }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    console.log(`Oliveyoung relay ready on 127.0.0.1:${port}`);
    const close = () => { server.close(); void browser.close().then(() => process.exit(0)); };
    process.once('SIGTERM', close); process.once('SIGINT', close);
  } catch (error) { await browser.close(); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('올리브영 릴레이 시작 실패: 토큰, 포트 및 GUI 브라우저 접속을 확인하세요.'); process.exitCode = 1; });
}
