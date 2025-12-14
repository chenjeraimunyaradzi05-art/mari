<?php

namespace App\Services\HealthFitness;

use App\Models\HealthInsurancePlan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class HealthInsuranceMarketService
{
    /**
     * Sync plans with the external market data provider.
     *
     * @return int Number of plans updated/created
     *
     * @psalm-return int<0, max>
     */
    public function syncMarketRates(): int
    {
        // In a real application, this would be an API call.
        // $response = Http::get('https://api.insurance-market-data.com/v1/plans');
        // $marketData = $response->json();

        // Simulating market data with some random fluctuations
        $marketData = $this->getSimulatedMarketData();

        $count = 0;
        foreach ($marketData as $data) {
            HealthInsurancePlan::updateOrCreate(
                [
                    'provider_name' => $data['provider_name'],
                    'plan_name' => $data['plan_name'],
                ],
                [
                    'monthly_premium' => $data['monthly_premium'],
                    'deductible' => $data['deductible'],
                    'out_of_pocket_max' => $data['out_of_pocket_max'],
                    'coverage_type' => $data['coverage_type'],
                    'features' => $data['features'],
                    'rating' => $data['rating'],
                    'website_url' => $data['website_url'] ?? null,
                ]
            );
            $count++;
        }

        return $count;
    }

    /**
     * @return (float|string|string[])[][]
     *
     * @psalm-return list{array{provider_name: string, plan_name: string, deductible: float, out_of_pocket_max: float, coverage_type: 'EPO'|'HMO'|'PPO', features: list{0: string, 1: string, 2?: 'Dental Included'|'Maternity Care'|'Prescription Savings', 3?: 'Global Coverage'}, rating: float, monthly_premium: float}, array{provider_name: string, plan_name: string, deductible: float, out_of_pocket_max: float, coverage_type: 'EPO'|'HMO'|'PPO', features: list{0: string, 1: string, 2?: 'Dental Included'|'Maternity Care'|'Prescription Savings', 3?: 'Global Coverage'}, rating: float, monthly_premium: float}, array{provider_name: string, plan_name: string, deductible: float, out_of_pocket_max: float, coverage_type: 'EPO'|'HMO'|'PPO', features: list{0: string, 1: string, 2?: 'Dental Included'|'Maternity Care'|'Prescription Savings', 3?: 'Global Coverage'}, rating: float, monthly_premium: float}, array{provider_name: string, plan_name: string, deductible: float, out_of_pocket_max: float, coverage_type: 'EPO'|'HMO'|'PPO', features: list{0: string, 1: string, 2?: 'Dental Included'|'Maternity Care'|'Prescription Savings', 3?: 'Global Coverage'}, rating: float, monthly_premium: float}, array{provider_name: string, plan_name: string, deductible: float, out_of_pocket_max: float, coverage_type: 'EPO'|'HMO'|'PPO', features: list{0: string, 1: string, 2?: 'Dental Included'|'Maternity Care'|'Prescription Savings', 3?: 'Global Coverage'}, rating: float, monthly_premium: float}}
     */
    private function getSimulatedMarketData(): array
    {
        // Base plans
        $plans = [
            [
                'provider_name' => 'BlueCross',
                'plan_name' => 'Gold Premier',
                'base_premium' => 450.00,
                'deductible' => 1500.00,
                'out_of_pocket_max' => 5000.00,
                'coverage_type' => 'PPO',
                'features' => ['Telehealth', 'Gym Membership', 'Dental Included', 'Global Coverage'],
                'rating' => 4.5,
            ],
            [
                'provider_name' => 'Aetna',
                'plan_name' => 'Silver Saver',
                'base_premium' => 320.00,
                'deductible' => 3000.00,
                'out_of_pocket_max' => 7000.00,
                'coverage_type' => 'HMO',
                'features' => ['Free Annual Checkup', 'Vision Discount', 'Prescription Savings'],
                'rating' => 4.0,
            ],
            [
                'provider_name' => 'UnitedHealth',
                'plan_name' => 'Bronze Basic',
                'base_premium' => 210.00,
                'deductible' => 6000.00,
                'out_of_pocket_max' => 8500.00,
                'coverage_type' => 'EPO',
                'features' => ['24/7 Nurse Line', 'Digital ID Card'],
                'rating' => 3.5,
            ],
            [
                'provider_name' => 'Cigna',
                'plan_name' => 'Connect Flex',
                'base_premium' => 280.00,
                'deductible' => 4500.00,
                'out_of_pocket_max' => 7500.00,
                'coverage_type' => 'EPO',
                'features' => ['Mental Health Support', '$0 Virtual Care'],
                'rating' => 4.2,
            ],
            [
                'provider_name' => 'Kaiser Permanente',
                'plan_name' => 'Platinum HMO',
                'base_premium' => 520.00,
                'deductible' => 0.00,
                'out_of_pocket_max' => 4000.00,
                'coverage_type' => 'HMO',
                'features' => ['Integrated Care', 'No Deductible', 'Maternity Care'],
                'rating' => 4.8,
            ],
        ];

        // Apply "market fluctuations"
        return array_map(function ($plan) {
            $fluctuation = rand(-15, 15); // +/- $15 fluctuation
            $plan['monthly_premium'] = $plan['base_premium'] + $fluctuation;
            unset($plan['base_premium']);
            return $plan;
        }, $plans);
    }
}

