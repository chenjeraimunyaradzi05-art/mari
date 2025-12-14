import SocialController from '@/lib/controllers/Http/Controllers/Api/V1/SocialController';

export async function GET(req: Request) {
  return SocialController.feed(req, null);
}
