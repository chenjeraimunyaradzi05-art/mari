<?php

namespace App\Http\Responses;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * StreamedResponse that ensures Content-Type remains exactly 'text/csv' without a charset.
 */
final class PlainCsvStreamedResponse extends StreamedResponse
{
    /**
     * Prepare the response before it is sent to the client.
     */
    #[\Override]
    public function prepare(Request $request): static
    {
        // Let the parent do its normal preparation first
        $response = parent::prepare($request);

        // Then override the header to be exactly 'text/csv' and ensure no charset
        $this->headers->set('Content-Type', 'text/csv');
        $this->charset = null;

        return $response;
    }
}
