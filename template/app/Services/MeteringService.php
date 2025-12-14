<?php

namespace App\Services;

use App\Models\AppliedJob;
use App\Models\BillingCharge;
use App\Models\BillingMeter;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class MeteringService
{


    public function recordApplicationSubmission(AppliedJob $application): ?BillingMeter
    {
        $job = $application->job()->with('company')->first();

        if (!$job || !$job->company) {
            Log::info('metering.skip_missing_company', [
                'applied_job_id' => $application->id,
            ]);

            return null;
        }

        $candidateUserId = $application->candidate_id;
        $companyId = $job->company_id;

        if (!$this->eligibleForApplicationCharge($companyId, $job->id, $candidateUserId)) {
            return null;
        }

        return DB::transaction(function () use ($application, $job, $companyId, $candidateUserId) {
            $meter = BillingMeter::create([
                'company_id' => $companyId,
                'event_type' => BillingMeter::EVENT_APPLICATION_SUBMITTED,
                'job_id' => $job->id,
                'candidate_user_id' => $candidateUserId,
                'applied_job_id' => $application->id,
                'eligible' => true,
                'occurred_at' => $application->created_at ?? Carbon::now(),
                'meta' => [
                    'job_title' => $job->title,
                    'candidate_user_id' => $candidateUserId,
                    'company_name' => $job->company->name ?? null,
                ],
            ]);

            BillingCharge::create([
                'company_id' => $companyId,
                'meter_id' => $meter->id,
                'charge_type' => 'ppa',
                'amount_cents' => 0,
                'currency' => 'AUD',
                'status' => BillingCharge::STATUS_PENDING,
                'meta' => [
                    'job_id' => $job->id,
                    'applied_job_id' => $application->id,
                ],
            ]);

            Log::info('metering.application_recorded', [
                'meter_id' => $meter->id,
                'company_id' => $companyId,
                'job_id' => $job->id,
                'candidate_user_id' => $candidateUserId,
            ]);

            return $meter;
        });
    }

    protected function eligibleForApplicationCharge(int $companyId, int $jobId, ?int $candidateUserId): bool
    {
        if (!$candidateUserId) {
            return false;
        }

        $duplicateExists = BillingMeter::query()
            ->where('company_id', $companyId)
            ->where('event_type', BillingMeter::EVENT_APPLICATION_SUBMITTED)
            ->where('job_id', $jobId)
            ->where('candidate_user_id', $candidateUserId)
            ->where('occurred_at', '>=', Carbon::now()->subDays($this->duplicateWindowDays))
            ->exists();

        if ($duplicateExists) {
            Log::warning('metering.duplicate_application_blocked', [
                'company_id' => $companyId,
                'job_id' => $jobId,
                'candidate_user_id' => $candidateUserId,
            ]);

            return false;
        }

        return true;
    }
}

