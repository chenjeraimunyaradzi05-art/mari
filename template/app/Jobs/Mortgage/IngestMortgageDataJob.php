<?php

namespace App\Jobs\Mortgage;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

final class IngestMortgageDataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $data;

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Validate mortgage data for completeness and accuracy.
     *
     * @return (bool|string[])[]
     *
     * @psalm-return array{valid: bool, errors: list{0?: 'Amount must be positive.'|'Applicant name is required.', 1?: 'Applicant name is required.'}}
     */
    protected function validateData(array $data): array
    {
        $errors = [];
        if (empty($data['amount']) || $data['amount'] <= 0) {
            $errors[] = 'Amount must be positive.';
        }
        if (empty($data['applicant']) || !is_string($data['applicant'])) {
            $errors[] = 'Applicant name is required.';
        }
        // Add more validation rules as needed
        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }
}

