/** 부모의 IPC 단절과 정상 종료를 같은 회수 경로로 처리합니다. */
export function createGuardController<T extends { close(): Promise<void> }>(
  launch: () => Promise<T>,
  release: () => Promise<void>,
) {
  let startup: Promise<T> | undefined;
  let shutdown: Promise<void> | undefined;
  return {
    start() {
      startup ??= launch();
      return startup;
    },
    stop() {
      shutdown ??= (async () => {
        if (startup) {
          const owned = await startup;
          await owned.close();
        }
        await release();
      })();
      return shutdown;
    },
  };
}
