import PostsController from '@/lib/controllers/Http/Controllers/Api/V1/PostsController';

export async function GET(req: Request) {
  return PostsController.show(req, null);
}

export async function DELETE(req: Request) {
  return PostsController.remove(req, null);
}
