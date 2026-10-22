const { getAllowedOrigins, isStrongSecret, validateSecurityEnvironment } = require('../config/security');
const request = require('supertest');
const app = require('../index');

describe('Security configuration', () => {
  it('requires a strong JWT secret outside test mode', () => {
    expect(() => validateSecurityEnvironment({ NODE_ENV: 'development', JWT_SECRET: 'short' }))
      .toThrow(/JWT_SECRET/);
    expect(() => validateSecurityEnvironment({
      NODE_ENV: 'development',
      JWT_SECRET: 'securepay_jwt_secret_key_change_this_in_production_2024',
    })).toThrow(/JWT_SECRET/);
    expect(() => validateSecurityEnvironment({
      NODE_ENV: 'development',
      JWT_SECRET: '7b4d0a2c6e1f8a3d9c5b2e7f4a1d6c8b',
    })).not.toThrow();
  });

  it('requires an explicit strong webhook secret in production', () => {
    expect(() => validateSecurityEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: '7b4d0a2c6e1f8a3d9c5b2e7f4a1d6c8b',
    })).toThrow(/WEBHOOK_SECRET/);
    expect(() => validateSecurityEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: '7b4d0a2c6e1f8a3d9c5b2e7f4a1d6c8b',
      WEBHOOK_SECRET: '9f6c1a3b8d2e4f7c0a5b9e1d6c3f8a2b',
    })).not.toThrow();
    expect(() => validateSecurityEnvironment({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('uses configured origins and only adds local development origins in development', () => {
    expect([...getAllowedOrigins({
      NODE_ENV: 'development',
      FRONTEND_URL: 'https://securepay.example, https://admin.example',
    })]).toEqual([
      'https://securepay.example',
      'https://admin.example',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
    expect([...getAllowedOrigins({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://securepay.example',
    })]).toEqual(['https://securepay.example']);
  });

  it('rejects secrets that are short, placeholders, or low-diversity', () => {
    expect(isStrongSecret('a'.repeat(40))).toBe(false);
    expect(isStrongSecret('replace-with-a-random-secret')).toBe(false);
    expect(isStrongSecret('7b4d0a2c6e1f8a3d9c5b2e7f4a1d6c8b')).toBe(true);
  });

  it('adds CORS headers only for configured or local development origins', async () => {
    const allowed = await request(app)
      .get('/api/v1/route-that-does-not-exist')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const denied = await request(app)
      .get('/api/v1/route-that-does-not-exist')
      .set('Origin', 'https://unapproved.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
