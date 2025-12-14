import ConnectionsController from '@/lib/controllers/Http/Controllers/Api/V1/ConnectionsController';

export async function GET(req: Request) {
  return ConnectionsController.list(req, null);
}

export async function POST(req: Request) {
  return ConnectionsController.connect(req, null);
}
