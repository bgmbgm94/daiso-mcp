/** PID와 생성 시각을 함께 확인하여 전용 브라우저 그룹만 회수합니다. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bounded } from './lifecycle.js';
export interface ProcessIdentity {
  pid: number;
  ppid: number;
  pgid: number;
  rss: number;
  birth: string;
  command?: string;
  crashDir?: string;
}
export function parseProcesses(text: string): ProcessIdentity[] {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9 || parts.slice(0, 4).some((part) => !/^\d+$/.test(part)))
        throw new Error('Invalid process snapshot');
      return {
        pid: Number(parts[0]),
        ppid: Number(parts[1]),
        pgid: Number(parts[2]),
        rss: Number(parts[3]) * 1024,
        birth: parts.slice(4, 9).join(' '),
        command: parts.slice(9).join(' '),
      };
    });
}
export async function processSnapshot(): Promise<ProcessIdentity[]> {
  const { stdout } = await promisify(execFile)(
    '/bin/ps',
    ['-axo', 'pid=,ppid=,pgid=,rss=,lstart=,command='],
    { timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
  );
  return parseProcesses(stdout);
}
const same = (a: ProcessIdentity, b: ProcessIdentity) =>
  a.pid === b.pid && a.birth === b.birth && a.pgid === b.pgid;
const crashHelper = (root: ProcessIdentity, row: ProcessIdentity) => {
  if (!root.crashDir || !row.command?.includes('chrome_crashpad_handler ')) return false;
  const marker = `--database=${root.crashDir}`;
  return row.command.endsWith(marker) || row.command.includes(`${marker} `);
};
const members = (root: ProcessIdentity, rows: ProcessIdentity[]) =>
  rows.filter((row) => row.pgid === root.pgid || crashHelper(root, row));
export function ownedGroup(root: ProcessIdentity, rows: ProcessIdentity[]): ProcessIdentity[] {
  if (root.pid !== root.pgid || !rows.some((row) => same(root, row)))
    throw new Error('Browser process identity uncertain');
  return members(root, rows);
}
export async function closeOwnedGroup(
  root: ProcessIdentity,
  close: () => Promise<unknown>,
  snapshot = processSnapshot,
  kill: (pid: number, signal: NodeJS.Signals) => unknown = process.kill,
): Promise<void> {
  const initial = await snapshot();
  const group = members(root, initial);
  if (!group.length) {
    await bounded(close(), 3000);
    return;
  }
  // 루트 프로세스가 이미 종료되었으면 소유권을 새로 추정하지 않습니다.
  const known = ownedGroup(root, initial);
  const closing = close();
  try {
    await bounded(closing, 3000);
  } catch {
    /* 아래에서 정체를 확인한 그룹만 강제 회수합니다. */
  }
  const remaining = members(root, await snapshot());
  if (!remaining.length) {
    await bounded(closing, 3000);
    return;
  }
  const remainingGroup = remaining.filter((row) => row.pgid === root.pgid);
  const helpers = remaining.filter((row) => crashHelper(root, row));
  if (
    (remainingGroup.length &&
      !remainingGroup.some((row) => known.some((previous) => same(previous, row)))) ||
    helpers.some((row) => !known.some((previous) => same(previous, row)))
  ) {
    throw new Error('Browser process identity uncertain');
  }
  const targets = helpers.map((row) => row.pid);
  if (remainingGroup.length) targets.unshift(-root.pgid);
  for (const target of targets) {
    try {
      kill(target, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    if (!members(root, await snapshot()).length) {
      await bounded(closing, 3000);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Browser process group still alive');
}
