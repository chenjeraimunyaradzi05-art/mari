import AuthController from '@/lib/controllers/Http/Controllers/Api/V1/AuthController';

export async function GET(req: Request) {
  return AuthController.user(req, null);
}
