const request = require('supertest');
const app = require('../index');

describe('Projection API', () => {
  test('health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });

  test('projection returns expected shape', async () => {
    const payload = {
      tax_context: {
        income_sources: [{type: 'w2', amount: 50000}, {type: '1099', amount: 20000}],
        biz_expenses: [{category: 'supplies', amount: 2000}],
        rentals: [{address: '1 Main St', net_income: 5000}]
      }
    };

    const res = await request(app).post('/projection').send(payload);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('projection');
  });
});
