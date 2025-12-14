import PaymentsController from '@/lib/controllers/Http/Controllers/Api/V1/PaymentsController';

export async function GET(req: Request) {
  return PaymentsController.list(req, null);
}

export async function POST(req: Request) {
  return PaymentsController.create(req, null);
}
