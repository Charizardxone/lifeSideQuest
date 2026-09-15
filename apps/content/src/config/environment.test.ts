import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment';

const valid = {
  DATABASE_URL: 'postgresql://test:private-password@localhost:5432/sidequest',
  PAYLOAD_SECRET: 'test-only-secret-with-at-least-32-characters',
  CONTENT_SERVER_URL: 'http://localhost:3000',
  WEB_ORIGIN: 'http://localhost:5173',
};

describe('content environment', () => {
  it('accepts an existing PostgreSQL connection and explicit origins', () => {
    expect(parseEnvironment(valid)).toEqual(valid);
  });
  it('reports missing fields without leaking secrets', () => {
    expect(() => parseEnvironment({ ...valid, DATABASE_URL: 'private-password' })).toThrow(
      'DATABASE_URL',
    );
    expect(() => parseEnvironment({ ...valid, DATABASE_URL: 'private-password' })).not.toThrow(
      'private-password',
    );
  });
  it.each([
    '*',
    'https://example.com/path',
    'https://user:pass@example.com',
    'javascript:alert(1)',
  ])('rejects a non-origin allowlist value: %s', (WEB_ORIGIN) => {
    expect(() => parseEnvironment({ ...valid, WEB_ORIGIN })).toThrow('WEB_ORIGIN');
  });
  it('rejects the example secret and missing configuration', () => {
    expect(() =>
      parseEnvironment({
        ...valid,
        PAYLOAD_SECRET: 'REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS',
      }),
    ).toThrow('PAYLOAD_SECRET');
    expect(() => parseEnvironment({})).toThrow('Invalid content environment');
  });
});
