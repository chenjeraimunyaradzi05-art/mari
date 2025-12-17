<?php
/**
 * VerifyCsrfToken Middleware
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

final class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array<int, string>
     */
    protected $except = [
        //
    ];

    /**
     * Ensure CSRF verification is bypassed when executing the test suite.
     */
    #[\Override]
    protected function runningUnitTests()
    {
        return parent::runningUnitTests() || $this->app->environment('testing');
    }
}

