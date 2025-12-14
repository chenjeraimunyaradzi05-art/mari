import PostsController from '@/lib/controllers/Http/Controllers/Api/V1/PostsController';

export async function GET(req: Request) {
  return PostsController.list(req, null);
}

export async function POST(req: Request) {
  return PostsController.create(req, null);
}
