<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Integrations\TurboTax\IntegrationGateway;
use Illuminate\Http\Request;

class TurboTaxController extends Controller
{
    protected IntegrationGateway $gateway;

    public function __construct(IntegrationGateway $gateway = null)
    {
        $this->gateway = $gateway ?? new IntegrationGateway();
    }

    public function index()
    {
        // Minimal status / stats for a POC admin area
        $stats = [
            'connected_users' => 0,
            'active_tokens' => 0,
        ];

        return view('admin.turbotax.index', ['stats' => $stats]);
    }

    public function runProjection(Request $request)
    {
        $request->validate([
            'tax_context' => 'nullable|string',
        ]);

        $payload = [];
        if ($request->filled('tax_context')) {
            try {
                $payload = json_decode($request->input('tax_context'), true, 512, JSON_THROW_ON_ERROR);
            } catch (\Throwable $e) {
                return back()->withErrors(['tax_context' => 'Invalid JSON: ' . $e->getMessage()]);
            }
        }

        // If no payload provided, use a small example default
        if (empty($payload)) {
            $payload = [
                'name' => 'Example User',
                'ssn' => null,
                'filing_status' => 'single',
                'income_sources' => [
                    ['type' => 'w2', 'amount' => 65000, 'source' => 'Employer A'],
                    ['type' => 'self_employed', 'amount' => 12000, 'source' => 'Side Hustle'],
                ],
                'biz_expenses' => [
                    ['category' => 'office', 'amount' => 1000],
                ],
            ];
        }

        $mapped = $this->gateway->buildPayloadFromTaxContext($payload);
        $result = $this->gateway->sendProjection($mapped);

        return back()->with('projection', $result)->with('payload', $mapped);
    }
}
