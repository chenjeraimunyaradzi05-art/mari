<?php
/**
 * TrustHosts Middleware
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustHosts as Middleware;

final class TrustHosts extends Middleware
{
    /**
     * Get the host patterns that should be trusted.
     *
     * @return (null|string)[]
     *
     * @psalm-return list{null|string}
     */
    #[\Override]
    public function hosts(): array
    {
        return [
            $this->allSubdomainsOfApplicationUrl(),
        ];
    }
}

