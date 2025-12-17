<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Symfony\Component\HttpFoundation\Response;

final class RoleDashboardTelemetryAuthenticate extends Middleware
{
    /**
     * Handle an unauthenticated user by returning 403 for telemetry routes.
     */
    #[\Override]
    protected function unauthenticated($request, array $guards)
    {
        abort(Response::HTTP_FORBIDDEN, 'Forbidden');
    }
}

