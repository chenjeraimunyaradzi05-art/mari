<?php

namespace App\Http\Controllers\Api\Integrations;

use App\Http\Controllers\Controller;
use App\Services\Integrations\TurboTax\IntegrationGateway;
use Illuminate\Http\Request;

class TurboTaxProxyController extends Controller
{
    protected IntegrationGateway $gateway;

    public function __construct(IntegrationGateway $gateway = null)
    {
        $this->gateway = $gateway ?? new IntegrationGateway();
    }

    public function projection(Request $request)
    {
        $data = $request->input('tax_context', []);

        // Map the tax context to an API payload and run a projection (POC - mocked calculation)
        $payload = $this->gateway->buildPayloadFromTaxContext($data);
        $projection = $this->gateway->sendProjection($payload);

        return response()->json(["ok" => true, "projection" => $projection]);
    }
}
