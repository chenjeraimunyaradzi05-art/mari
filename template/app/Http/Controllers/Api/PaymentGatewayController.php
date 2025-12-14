<?php
/**
 * PaymentGatewayController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentGatewaySettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class PaymentGatewayController extends Controller
{
    public function __construct(
        private PaymentGatewaySettingService $gatewayService
    ) {
        $this->middleware(['auth:sanctum', 'api.rate.limit:admin']);
    }

    /**
     * Get payment gateway configuration summary
     */
    public function index(): JsonResponse
    {
        try {
            $summary = $this->gatewayService->getConfigurationSummary();

            return response()->json([
                'success' => true,
                'data' => $summary
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch gateway summary',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get specific gateway configuration
     */
    public function show(string $gateway): JsonResponse
    {
        try {
            $settings = $this->gatewayService->getGatewaySettings($gateway);
            $configured = $this->gatewayService->isGatewayConfigured($gateway);
            $status = $this->gatewayService->getGatewayStatus($gateway);

            // Mask sensitive data
            $maskedSettings = $this->maskSensitiveData($settings);

            return response()->json([
                'success' => true,
                'data' => [
                    'gateway' => $gateway,
                    'configured' => $configured,
                    'status' => $status,
                    'settings' => $maskedSettings
                ]
            ]);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch gateway configuration',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update gateway configuration
     */
    public function update(Request $request, string $gateway): JsonResponse
    {
        try {
            $settings = $request->all();

            $this->gatewayService->updateGatewaySettings($gateway, $settings);

            return response()->json([
                'success' => true,
                'message' => "Gateway '{$gateway}' configuration updated successfully"
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update gateway configuration',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Test gateway connection
     */
    public function test(string $gateway): JsonResponse
    {
        try {
            $result = $this->gatewayService->testGatewayConnection($gateway);

            return response()->json([
                'success' => $result['success'],
                'message' => $result['message']
            ], $result['success'] ? 200 : 400);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gateway test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Enable/disable gateway
     */
    public function setStatus(Request $request, string $gateway): JsonResponse
    {
        $request->validate([
            'status' => 'required|boolean'
        ]);

        try {
            $status = $request->boolean('status');
            $this->gatewayService->setGatewayStatus($gateway, $status);

            $action = $status ? 'enabled' : 'disabled';

            return response()->json([
                'success' => true,
                'message' => "Gateway '{$gateway}' {$action} successfully"
            ]);

        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update gateway status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all configured gateways
     */
    public function configured(): JsonResponse
    {
        try {
            $gateways = $this->gatewayService->getConfiguredGateways();

            // Mask sensitive data for all gateways
            foreach ($gateways as $gateway => &$config) {
                $config['settings'] = $this->maskSensitiveData($config['settings']);
            }

            return response()->json([
                'success' => true,
                'data' => $gateways
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch configured gateways',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk test all configured gateways
     */
    public function testAll(): JsonResponse
    {
        try {
            $gateways = $this->gatewayService->getConfiguredGateways();
            $results = [];

            foreach (array_keys($gateways) as $gateway) {
                $results[$gateway] = $this->gatewayService->testGatewayConnection($gateway);
            }

            $allPassed = array_reduce($results, fn($carry, $result) => $carry && $result['success'], true);

            return response()->json([
                'success' => $allPassed,
                'message' => $allPassed ? 'All gateways tested successfully' : 'Some gateway tests failed',
                'results' => $results
            ], $allPassed ? 200 : 400);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bulk gateway test failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mask sensitive data in settings
     */
    private function maskSensitiveData(array $settings): array
    {
        $sensitiveKeys = ['secret', 'key', 'password', 'token'];
        $masked = [];

        foreach ($settings as $key => $value) {
            $isSensitive = false;
            foreach ($sensitiveKeys as $sensitiveKey) {
                if (str_contains(strtolower($key), $sensitiveKey)) {
                    $isSensitive = true;
                    break;
                }
            }

            $masked[$key] = $isSensitive ? str_repeat('*', min(12, strlen($value))) : $value;
        }

        return $masked;
    }
}

