<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Job;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class CompanyLocationBackfillSeeder extends Seeder
{
    public function run(): void
    {
        $updated = 0;

        Company::query()
            ->where(function ($query) {
                $query->whereNull('country')
                    ->orWhereNull('state')
                    ->orWhereNull('city');
            })
            ->chunkById(200, function ($companies) use (&$updated) {
                foreach ($companies as $company) {
                    $needsCountry = blank($company->country);
                    $needsState = blank($company->state);
                    $needsCity = blank($company->city);

                    if (! $needsCountry && ! $needsState && ! $needsCity) {
                        continue;
                    }

                    $job = Job::query()
                        ->where('company_id', $company->id)
                        ->where(function ($query) use ($needsCountry, $needsState, $needsCity) {
                            if ($needsCountry) {
                                $query->orWhereNotNull('country_id');
                            }
                            if ($needsState) {
                                $query->orWhereNotNull('state_id');
                            }
                            if ($needsCity) {
                                $query->orWhereNotNull('city_id');
                            }
                        })
                        ->latest('created_at')
                        ->first();

                    if (! $job) {
                        continue;
                    }

                    $attributes = [];

                    if ($needsCountry && $job->country_id) {
                        $attributes['country'] = $job->country_id;
                    }
                    if ($needsState && $job->state_id) {
                        $attributes['state'] = $job->state_id;
                    }
                    if ($needsCity && $job->city_id) {
                        $attributes['city'] = $job->city_id;
                    }

                    if (empty($attributes)) {
                        continue;
                    }

                    DB::transaction(function () use ($company, $attributes, &$updated) {
                        $company->fill($attributes);
                        $company->save();
                        $updated++;
                    });
                }
            });

        $this->command?->info("Company location backfill completed ({$updated} companies updated).");
    }
}

