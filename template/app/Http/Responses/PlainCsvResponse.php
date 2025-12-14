<?php

namespace App\Http\Responses;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Response that ensures Content-Type remains exactly 'text/csv' without a charset.
 */
final class PlainCsvResponse extends Response
{
    /**
     * Prepare the response before it is sent to the client.
     */
    #[\Override]
    public function prepare(Request $request): static
    {
        $response = parent::prepare($request);

        // Force exact content type without charset
        $this->headers->set('Content-Type', 'text/csv');
        $this->charset = null;

        return $response;
    }
}
