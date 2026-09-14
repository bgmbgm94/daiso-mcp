import { describe, expect, it } from 'vitest';
import { CLI_SMOKE_COMMANDS } from '../../scripts/ops/cli-smoke.js';

describe('영화관 CLI smoke', () => {
  it('메가박스 전용 명령으로 실행한다', () => {
    expect(CLI_SMOKE_COMMANDS.find((command) => command.service === 'megabox')?.args[0]).toBe(
      'megabox-theaters',
    );
  });
  it('디트릭스 실제 상영작 응답을 확인한다', () => {
    const scenario = CLI_SMOKE_COMMANDS.find((command) => command.service === 'dtryx');
    expect(scenario).toBeDefined();
    expect(
      scenario?.validate(
        JSON.stringify({
          success: true,
          data: { movies: [{ movieCode: '1', movieName: '영화' }] },
        }),
        '',
      ),
    ).toBeNull();
    for (const movies of [undefined, [], [{}], [{ movieCode: '1' }]]) {
      expect(
        scenario?.validate(JSON.stringify({ success: true, data: { movies } }), ''),
      ).toBeTypeOf('string');
    }
  });
});
