import AuthController from '@/lib/controllers/Http/Controllers/Api/V1/AuthController';

export async function POST(req: Request) {
  return AuthController.refresh(req, null);
}
