/** API와 MCP에서 공통으로 사용하는 디트릭스 입력 검증 */
import * as z from 'zod';

export const dtryxLimitSchema = z.number().int().min(1).max(200);
export const dtryxTimeoutSchema = z.number().int().min(1).max(60000);
export const dtryxDateSchema = z.string().refine((value) => {
  if (!/^(\d{8}|\d{4}-\d{2}-\d{2})$/.test(value)) return false;
  const compact = value.replace(/-/g, '');
  const dashed = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  const date = new Date(`${dashed}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dashed;
});

const optionsSchema = z.object({
  limit: dtryxLimitSchema.optional(),
  timeoutMs: dtryxTimeoutSchema.optional(),
  playDate: dtryxDateSchema.optional(),
});
export const DTRYX_INVALID_INPUT =
  'limit은 1~200, timeoutMs는 1~60000 사이의 정수이며 playDate는 유효한 YYYYMMDD 또는 YYYY-MM-DD 날짜여야 합니다.';

export function hasInvalidDtryxOptions(options: unknown): boolean {
  return !optionsSchema.safeParse(options).success;
}
