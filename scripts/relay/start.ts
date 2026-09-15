/** 실행 시에만 로컬 브라우저 릴레이를 시작합니다. */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createBrowserLifecycle } from './lifecycle.js';
import { launchGuardedBrowser } from './supervisor.js';
import { createFileQuota } from './quota.js';
import { createOliveyoungRelay } from './oliveyoung.js';

async function main() {
  const token = process.env.OY_RELAY_TOKEN;
  if (!token?.trim()) throw new Error('OY_RELAY_TOKEN이 필요합니다.');
  const port = Number(process.env.OY_RELAY_PORT || 4319);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('OY_RELAY_PORT 값이 잘못되었습니다.');
  const stateDir = process.env.OY_RELAY_STATE_DIR;
  if (!stateDir) throw new Error('OY_RELAY_STATE_DIR이 필요합니다.');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const takeQuota = await createFileQuota(join(stateDir, 'quota.json'));
  const lifecycle = createBrowserLifecycle(() =>
    launchGuardedBrowser(join(stateDir, 'browser-owner.json')),
  );
  try {
    await lifecycle.start();
    const handler = createOliveyoungRelay(token, lifecycle.run, {
      takeQuota,
      status: lifecycle.status,
    });
    const server = createServer(async (req, res) => {
      try {
        const controller = new AbortController();
        res.once('close', () => controller.abort());
        const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
          signal: controller.signal,
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Readable.toWeb(req),
          duplex: 'half',
        } as RequestInit & { duplex: 'half' });
        const response = await handler(request);
        res.writeHead(response.status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(await response.text());
      } catch {
        res.writeHead(500);
        res.end('{"error":"Relay failure"}');
      }
    });
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    console.log(`Oliveyoung relay ready on 127.0.0.1:${port}`);
    let stopping = false;
    const close = () => {
      if (stopping) return;
      stopping = true;
      server.close();
      server.closeAllConnections();
      void lifecycle
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    };
    process.once('SIGTERM', close);
    process.once('SIGINT', close);
  } catch (error) {
    await lifecycle.close();
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('올리브영 릴레이 시작 실패: 토큰, 포트 및 GUI 브라우저 접속을 확인하세요.');
    process.exitCode = 1;
  });
}
