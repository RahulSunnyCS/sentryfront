import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  buildCrawl,
  diffFindings,
  discoverFixtures,
  installFetchMock,
  MODULE_REGISTRY,
  type ExpectedOutput,
  type FetchSpec,
} from './runner';

const cases = discoverFixtures();

describe('Scanner module fixtures', () => {
  it('discovers at least one fixture case', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const fixture of cases) {
    const runner = MODULE_REGISTRY[fixture.moduleId];

    describe(`${fixture.moduleId}`, () => {
      if (!runner) {
        it.skip(`${fixture.name} (no runner registered for ${fixture.moduleId})`, () => {});
        return;
      }

      it(fixture.name, async () => {
        const crawl = buildCrawl(fixture.inputs);
        const expected = JSON.parse(
          fs.readFileSync(fixture.expectedPath, 'utf8'),
        ) as ExpectedOutput;

        const spec: FetchSpec = fixture.inputs.fetch
          ? (JSON.parse(fixture.inputs.fetch) as FetchSpec)
          : {};
        const restoreFetch = installFetchMock(spec);

        let actual;
        try {
          actual = await runner(crawl);
        } finally {
          restoreFetch();
        }
        const { missing, unexpected } = diffFindings(expected.findings, actual);

        if (missing.length || unexpected.length) {
          const lines: string[] = [];
          if (missing.length) {
            lines.push('Missing expected findings:');
            for (const m of missing) lines.push(`  - ${JSON.stringify(m)}`);
          }
          if (unexpected.length) {
            lines.push('Unexpected findings:');
            for (const a of unexpected) {
              lines.push(
                `  - { moduleId: ${a.moduleId}, severity: ${a.severity}, title: ${JSON.stringify(a.title)} }`,
              );
            }
          }
          throw new Error(`Fixture mismatch (${fixture.moduleId}/${fixture.name}):\n${lines.join('\n')}`);
        }

        expect({ missing, unexpected }).toEqual({ missing: [], unexpected: [] });
      });
    });
  }
});
