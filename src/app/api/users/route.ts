import UserController from '@/lib/controllers/Http/Controllers/Api/V1/UserController';

export async function GET(req: Request) {
  return UserController.list(req, null);
}
