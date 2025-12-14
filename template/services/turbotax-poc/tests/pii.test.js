const request = require('supertest');
const fs = require('fs');
const path = require('path');

process.env.TURBOTAX_DATA_DIR = path.join(__dirname, '..', 'data-test');
process.env.TURBOTAX_MASTER_KEY = 'test_master_key_1234567890';

const app = require('../index');

describe('PII storage', () => {
  beforeAll(() => {
    const dir = process.env.TURBOTAX_DATA_DIR;
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  });

  afterAll(() => {
    const dir = process.env.TURBOTAX_DATA_DIR;
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  });

  test('stores PII encrypted and returns masked value', async () => {
    const res = await request(app)
      .post('/pii/store')
      .send({ user_id: 'u123', pii: { ssn: '123456789' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.masked).toBe('***-**-6789');

    // check file exists
    const file = path.join(process.env.TURBOTAX_DATA_DIR, 'pii_u123.enc');
    expect(fs.existsSync(file)).toBe(true);
  });
});
