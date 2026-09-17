import {
  assertQaAuthConfiguration,
  assertQaDatabaseMarker,
  assertQaSetupConfiguration,
  isQaAuthEnabled,
} from './qa-environment';

const enabled = {
  NODE_ENV: 'production',
  APP_ENVIRONMENT: 'qa',
  ENABLE_QA_AUTH: 'true',
  QA_AUTH_KEY: 'qa-key',
  QA_DATABASE_INSTANCE_ID: 'qa-instance',
};

describe('QA environment safety', () => {
  it('enables only the exact QA production configuration', () => {
    expect(isQaAuthEnabled(enabled)).toBe(true);
    expect(isQaAuthEnabled({ ...enabled, NODE_ENV: 'development' })).toBe(
      false,
    );
    expect(isQaAuthEnabled({ ...enabled, APP_ENVIRONMENT: 'production' })).toBe(
      false,
    );
    expect(isQaAuthEnabled({ ...enabled, ENABLE_QA_AUTH: 'false' })).toBe(
      false,
    );
  });

  it('requires the key and database instance id when enabled', () => {
    expect(() => assertQaAuthConfiguration(enabled)).not.toThrow();
    expect(() =>
      assertQaAuthConfiguration({ ...enabled, QA_AUTH_KEY: '' }),
    ).toThrow('QA_AUTH_KEY');
    expect(() =>
      assertQaAuthConfiguration({ ...enabled, QA_DATABASE_INSTANCE_ID: '' }),
    ).toThrow('QA_AUTH_KEY');
  });

  it('requires explicit QA production configuration for setup', () => {
    expect(() => assertQaSetupConfiguration(enabled)).not.toThrow();
    expect(() =>
      assertQaSetupConfiguration({ ...enabled, APP_ENVIRONMENT: 'production' }),
    ).toThrow('APP_ENVIRONMENT=qa');
  });

  it('accepts only the matching QA database marker', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { environment_kind: 'qa', instance_id: 'qa-instance' },
      ]);
    await expect(
      assertQaDatabaseMarker({ query } as any, enabled),
    ).resolves.toBeUndefined();
    query.mockResolvedValueOnce([
      { environment_kind: 'production', instance_id: 'qa-instance' },
    ]);
    await expect(
      assertQaDatabaseMarker({ query } as any, enabled),
    ).rejects.toThrow('marcador QA');
  });
});
