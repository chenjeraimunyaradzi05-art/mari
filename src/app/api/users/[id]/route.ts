import UserController from '@/lib/controllers/Http/Controllers/Api/V1/UserController';

export async function GET(req: Request) {
  return UserController.show(req, null);
}

export async function PATCH(req: Request) {
  return UserController.update(req, null);
}

export async function PUT(req: Request) {
  return UserController.update(req, null);
}
