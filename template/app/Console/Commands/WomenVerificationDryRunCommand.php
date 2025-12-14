<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\WomenRealEstate\WomenVerificationDryRunService;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

final class WomenVerificationDryRunCommand extends Command
{
    protected $signature = 'women:verification:dry-run
        {--agent= : Agent ID or email to target.}
        {--lead-days=30 : Days before expiry to trigger reverification.}
        {--fraud-score= : Override the simulated fraud score (0-1).}
        {--regulator-status= : Override the regulator status (ok, mismatch).}
        {--show-signals : Output the resolved screening signals.}';

    protected $description = 'Run a dry run of the women real estate verification workflow pipeline.';

    /**
     * @return (array|scalar)[]|ValidationException
     *
     * @psalm-return ValidationException|array<'fraud_score'|'lead_days'|'regulator_status', array|scalar>
     */
    private function validatedOptions(WomenVerificationDryRunService $dryRun): array|ValidationException
    {
        try {
            $input = [
                'lead_days' => (int) $this->option('lead-days'),
                'fraud_score' => $this->option('fraud-score'),
                'regulator_status' => $this->option('regulator-status'),
            ];

            if ($input['fraud_score'] !== null) {
                $input['fraud_score'] = (float) $input['fraud_score'];
            }

            if ($input['fraud_score'] !== null && ($input['fraud_score'] < 0 || $input['fraud_score'] > 1)) {
                throw ValidationException::withMessages([
                    'fraud_score' => ['Fraud score must be between 0 and 1.'],
                ]);
            }

            if ($input['regulator_status'] !== null && ! in_array($input['regulator_status'], $dryRun->validRegulatorStatuses(), true)) {
                throw ValidationException::withMessages([
                    'regulator_status' => [sprintf('Regulator status must be one of: %s.', implode(', ', $dryRun->validRegulatorStatuses()))],
                ]);
            }

            if ($input['lead_days'] < 0) {
                throw ValidationException::withMessages([
                    'lead_days' => ['Lead days must be zero or greater.'],
                ]);
            }

            return array_filter($input, static fn ($value) => $value !== null);
        } catch (ValidationException $exception) {
            return $exception;
        }
    }
}

