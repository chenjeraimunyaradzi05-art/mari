const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Ensure we are using a test data directory and a master key so the token store can operate
process.env.TURBOTAX_DATA_DIR = path.join(__dirname, '..', 'data-test');
process.env.TURBOTAX_MASTER_KEY = 'test_master_key_1234567890';

const app = require('../index');

describe('OAuth flow', () => {
  beforeAll(async () => {
    // ensure directory is clean
    const dir = process.env.TURBOTAX_DATA_DIR;
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  });

  afterAll(async () => {
    // cleanup files
    const dir = process.env.TURBOTAX_DATA_DIR;
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  });

  test('connect returns a redirect to the auth provider', async () => {
    const res = await request(app).get('/oauth/connect?user_id=testuser');
    expect(res.statusCode).toBe(302); // redirect
    expect(res.headers.location).toMatch(/connect\/oauth2\?/);
  });

  test('callback exchanges code and saves encrypted tokens', async () => {
    // mock global fetch for token exchange
    const mockedResponse = { access_token: 'tok1', refresh_token: 'ref1', expires_in: 3600 };
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve(mockedResponse) }));

    const res = await request(app).get('/oauth/callback?code=abc123&user_id=testuser');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    // confirm encrypted token file exists
    const tokenFile = path.join(process.env.TURBOTAX_DATA_DIR, 'tokens_testuser.enc');
    expect(fs.existsSync(tokenFile)).toBe(true);
  });
});
