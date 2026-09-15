import { expect, it, vi } from 'vitest';
import { createGuardController } from '../../scripts/relay/guard-controller.js';
it('부모 단절 시 브라우저 종료 확인 후 마커를 해제한다', async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const guard = createGuardController(async () => ({ close }), release);
  await guard.start();
  await guard.stop();
  await guard.stop();
  expect(close).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
  expect(close.mock.invocationCallOrder[0]).toBeLessThan(release.mock.invocationCallOrder[0]);
});
it('실행 중 부모가 단절되어도 늦게 생성된 브라우저를 회수한다', async () => {
  let finish!: (value: { close: () => Promise<void> }) => void;
  const close = vi.fn().mockResolvedValue(undefined);
  const release = vi.fn();
  const guard = createGuardController(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    release,
  );
  const starting = guard.start();
  const stopping = guard.stop();
  finish({ close });
  await starting;
  await stopping;
  expect(close).toHaveBeenCalledTimes(1);
});
it('브라우저 종료 실패에는 마커를 남겨 재실행을 차단한다', async () => {
  const release = vi.fn();
  const guard = createGuardController(
    async () => ({
      close: async () => {
        throw new Error('not gone');
      },
    }),
    release,
  );
  await guard.start();
  await expect(guard.stop()).rejects.toThrow('not gone');
  expect(release).not.toHaveBeenCalled();
});
it('실행 전 종료는 브라우저 없이 마커를 해제한다', async () => {
  const launch = vi.fn();
  const release = vi.fn().mockResolvedValue(undefined);
  const guard = createGuardController(launch, release);
  await guard.stop();
  expect(launch).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
});
