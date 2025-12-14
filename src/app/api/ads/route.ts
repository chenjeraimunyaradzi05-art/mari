import AdsController from '@/lib/controllers/Http/Controllers/Api/V1/AdsController';

export async function GET(req: Request) {
  return AdsController.listCampaigns(req, null);
}

export async function POST(req: Request) {
  return AdsController.createCampaign(req, null);
}
