import AdminDashboardController from '@/lib/controllers/Http/Controllers/Api/V1/AdminDashboardController';

export async function GET(req: Request) {
  return AdminDashboardController.overview(req, null);
}
