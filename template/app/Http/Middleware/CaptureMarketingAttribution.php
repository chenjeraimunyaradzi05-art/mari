<?php

namespace App\Http\Middleware;

use App\Services\Growth\MarketingAttributionService;
use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class CaptureMarketingAttribution
{
    protected MarketingAttributionService $attributionService;

    public function __construct(MarketingAttributionService $attributionService)
    {
        $this->attributionService = $attributionService;
    }

    /**
     * Handle an incoming request and capture marketing attribution parameters.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Capture attribution (if any). Pass the currently authenticated user if present.
        $this->attributionService->captureAttribution($request, Auth::user());

        return $next($request);
    }
}

