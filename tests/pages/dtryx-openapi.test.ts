import { describe, expect, it } from 'vitest';
import { generateFullOpenApiSpec } from '../../src/pages/openapiFullSpec.js';
import { ACTION_QUERY_DEFINITIONS } from '../../src/api/actionsProxy.js';
import { ACTION_QUERY_PARAMETERS } from '../../src/pages/openapiSpecActionParameters.js';
import { HEALTH_CHECKS } from '../../src/api/healthCheckDefinitions.js';

describe('디트릭스 공개 API 계약', () => {
  it.each(['cinemas', 'movies', 'seats'])('%s 경로와 Actions를 노출한다', (resource) => {
    const spec = generateFullOpenApiSpec('https://example.com') as {
      paths: Record<string, unknown>;
    };
    const path = `/api/dtryx/${resource}`;
    expect(spec.paths[path]).toBeDefined();
    expect(ACTION_QUERY_DEFINITIONS.some((definition) => definition.targetPath === path)).toBe(
      true,
    );
  });
  it('Actions에 극장 코드와 필터를 전달할 수 있다', () => {
    expect(ACTION_QUERY_PARAMETERS.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining([
        'cinemaCode',
        'brandCode',
        'region',
        'movieName',
        'includePlayDates',
      ]),
    );
  });
  it('실제 상영작을 확인하는 전체 운영 검사를 등록한다', () => {
    expect(HEALTH_CHECKS).toContainEqual(
      expect.objectContaining({
        id: 'dtryx.movies',
        service: 'dtryx',
        mode: 'deep',
        collectionKey: 'movies',
      }),
    );
  });
});
