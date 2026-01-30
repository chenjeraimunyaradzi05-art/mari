
import request from 'supertest';
import app from '../index';
import { prisma } from '../utils/prisma';

describe('Registration Debug', () => {
    const email = `test_debug_${Date.now()}@example.com`;

    afterAll(async () => {
      // Clean up
      try {
        await prisma.user.delete({ where: { email } }).catch(() => {});
      } catch (e) {}
      await prisma.$disconnect();
    });

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email,
                password: 'Password123!',
                firstName: 'Test',
                lastName: 'User',
                persona: 'EARLY_CAREER',
                womanSelfAttested: true,
            });
        
        if (res.status !== 201) {
            console.error('Registration failed:', JSON.stringify(res.body, null, 2));
        }
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
});
