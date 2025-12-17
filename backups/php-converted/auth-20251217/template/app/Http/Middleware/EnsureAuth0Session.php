<?php

namespace App\Http\Middleware;

use App\Services\Auth\Auth0TokenVerifier;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

final class EnsureAuth0Session
{


    protected function kick(Request $request, string $message): RedirectResponse
    {
        $request->session()->forget('auth0');

        return redirect()->route('admin.auth0.login')->withErrors([
            'auth0' => $message,
        ]);
    }

    protected function hasRequiredScopes(array $granted): bool
    {
        $required = array_filter((array) config('auth0.required_scopes', []));

        foreach ($required as $scope) {
            if (!in_array($scope, $granted, true)) {
                return false;
            }
        }

        return true;
    }
}

