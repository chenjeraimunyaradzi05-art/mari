<?php

namespace App\Http\Responses;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class CsvResponse extends Response
{
    #[\Override]
    public function prepare(Request $request): static
    {
        parent::prepare($request);

        $this->headers->set('Content-Type', 'text/csv');

        return $this;
    }
}

