<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AdvertisingCreative;
use App\Services\Advertising\AdvertisingMetricIngestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class AdvertisingBeaconController extends Controller
{
    public function __invoke(Request $request, AdvertisingMetricIngestionService $ingestion): JsonResponse
    {
        $validated = $request->validate([
            'creative_id' => ['required', 'integer', 'exists:advertising_creatives,id'],
            'campaign_id' => ['required', 'integer'],
            'slot' => ['required', 'string', 'max:120'],
            'event' => ['required', 'string', 'in:impression,click'],
            'signature' => ['required', 'string'],
            'meta' => ['nullable', 'array'],
        ]);

        $creative = AdvertisingCreative::query()
            ->whereKey($validated['creative_id'])
            ->firstOrFail();

        abort_unless((int) $creative->campaign_id === (int) $validated['campaign_id'], 422, 'Campaign mismatch');
        abort_unless($creative->isLaunchReady(), 422, 'Creative inactive');
        abort_unless($this->validSignature($creative, $validated['slot'], $validated['signature']), 422, 'Invalid signature');

        $ingestion->record($creative, $validated['event'], [
            'slot' => $validated['slot'],
            'device' => Arr::get($validated, 'meta.device'),
        ]);

        return response()->json(['status' => 'ok']);
    }

    protected function validSignature(AdvertisingCreative $creative, string $slot, string $signature): bool
    {
        $expected = hash_hmac('sha256', implode('|', [$creative->id, $creative->campaign_id, $slot]), $this->signingKey());

        return hash_equals($expected, (string) $signature);
    }

    protected function signingKey(): string
    {
        $key = (string) config('app.key');

        if (Str::startsWith($key, 'base64:')) {
            return base64_decode(substr($key, 7)) ?: $key;
        }

        return $key;
    }
}

