import ProfileController from '@/lib/controllers/Http/Controllers/Api/V1/ProfileController';

export async function GET(req: Request) {
  return ProfileController.show(req, null);
}

export async function PATCH(req: Request) {
  return ProfileController.update(req, null);
}

export async function PUT(req: Request) {
  return ProfileController.update(req, null);
}
