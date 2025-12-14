import AdminAnalyticsController from '@/lib/controllers/Http/Controllers/Api/V1/AdminAnalyticsController';

export async function GET(req: Request) {
  return AdminAnalyticsController.recentActivity(req, null);
}
