/**
 * 디트릭스 극장 목록 조회 도구
 */

import * as z from 'zod';
import { DTRYX_INVALID_INPUT, hasInvalidDtryxOptions, dtryxLimitSchema } from '../validation.js';
import type { McpToolResponse, ToolRegistration } from '../../../core/types.js';
import { resolveDtryxCinemas } from '../location.js';

interface ListCinemasArgs {
  keyword?: string;
  region?: string;
  brandCode?: string;
  limit?: number;
}

async function listCinemas(args: ListCinemasArgs): Promise<McpToolResponse> {
  if (hasInvalidDtryxOptions(args)) {
    return { isError: true, content: [{ type: 'text', text: DTRYX_INVALID_INPUT }] };
  }
  const { keyword, region, brandCode, limit = 50 } = args;
  const matched = resolveDtryxCinemas(args).slice(0, limit);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            filters: {
              keyword: keyword || null,
              region: region || null,
              brandCode: brandCode || null,
              limit,
            },
            count: matched.length,
            cinemas: matched,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function createListCinemasTool(): ToolRegistration {
  return {
    name: 'dtryx_list_cinemas',
    metadata: {
      title: '디트릭스 극장 목록 조회',
      description:
        '디트릭스 예매 플랫폼을 사용하는 독립·예술영화관 목록을 조회합니다. 극장명 키워드나 브랜드 코드로 걸러낼 수 있습니다.',
      inputSchema: {
        keyword: z.string().optional().describe('극장명 키워드 (예: 모모, 광주)'),
        region: z.string().optional().describe('광역 지역명 (예: 서울, 경기, 부산)'),
        brandCode: z.string().optional().describe('브랜드 코드 (indieart, etc, spacedog 중 하나)'),
        limit: dtryxLimitSchema.optional().default(50).describe('반환할 최대 극장 수 (기본값: 50)'),
      },
    },
    handler: ((args) => listCinemas(args as ListCinemasArgs)) as (
      args: unknown,
    ) => Promise<McpToolResponse>,
  };
}
