import SocialController from '@/lib/controllers/Http/Controllers/Api/V1/SocialController';

export async function POST(req: Request) {
  return SocialController.unfollow(req, null);
}
