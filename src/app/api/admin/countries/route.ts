import AdminCountryController from '@/lib/controllers/Http/Controllers/Api/V1/AdminCountryController';

export async function GET(req: Request) {
  return AdminCountryController.listCountries(req, null);
}
