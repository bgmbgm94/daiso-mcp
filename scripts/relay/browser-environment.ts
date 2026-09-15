/** 브라우저에는 운영 토큰 대신 GUI 실행에 필요한 환경만 전달합니다. */
export function browserEnvironment(
  env: NodeJS.ProcessEnv,
  crashDir: string,
): Record<string, string> {
  const result: Record<string, string> = { BREAKPAD_DUMP_LOCATION: crashDir };
  for (const name of [
    'HOME',
    'PATH',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'LC_MESSAGES',
    'LC_COLLATE',
    'LC_NUMERIC',
    'LC_TIME',
    'LC_MONETARY',
    'DISPLAY',
    'XAUTHORITY',
    '__CF_USER_TEXT_ENCODING',
  ]) {
    if (env[name] !== undefined) result[name] = env[name];
  }
  return result;
}
