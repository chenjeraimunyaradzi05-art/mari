<?php

namespace App\Http\Responses;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CsvStreamedResponse extends StreamedResponse
{
    #[\Override]
    public function prepare(Request $request): static
    {
        parent::prepare($request);

        $this->headers->set('Content-Type', 'text/csv');

        return $this;
    }
}

