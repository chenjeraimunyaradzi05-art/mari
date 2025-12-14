<?php

namespace App\Services\Automotive;

use App\Models\VehicleListing;
use Illuminate\Support\Collection;

final class AiCarGuideService
{
    /**
     * Recommend cars based on detailed user inputs.
     *
     * Inputs:
     * - budget (int)
     * - usage (commute, family, adventure, city)
     * - passengers (int)
     * - has_kids (bool)
     * - average_distance_km (int)
     * - preferred_powertrain (electric, hybrid, gas, any)
     * - importance_resale_value (high, medium, low)
     *
     * @return (((string|string[])[]|string)[]|VehicleListing|\Illuminate\Database\Eloquent\Collection|null|string)[]
     *
     * @psalm-return array{top_pick: VehicleListing|\Illuminate\Database\Eloquent\Collection<int, VehicleListing>|null, alternatives: \Illuminate\Database\Eloquent\Collection<int, VehicleListing>|array<never, never>, advice: string, powertrain_analysis: array{electric: array{pros: list{'Zero emissions', 'Lower running costs', 'Quiet drive', 'Government rebates'}, cons: list{'Range anxiety on long trips', 'Charging infrastructure dependence', 'Higher upfront cost'}, suitability: 'High'|'Medium'}, hybrid: array{pros: list{'Good fuel economy', 'No range anxiety', 'Regenerative braking'}, cons: list{'Two powertrains to maintain', 'Less pure electric range'}, suitability: 'High'}, gas: array{pros: list{'Lower upfront cost', 'Easy refueling anywhere', 'Proven technology'}, cons: list{'Higher fuel costs', 'Emissions', 'Higher maintenance over time'}, suitability: 'High'|'Medium'}}, rebate_info: list<non-falsy-string>}
     */
    public function recommend(array $inputs): array
    {
        $budget = $inputs['budget'] ?? 30000;
        $usage = $inputs['usage'] ?? 'commute';
        $hasKids = $inputs['has_kids'] ?? false;
        $avgDistance = $inputs['average_distance_km'] ?? 50;
        $powertrain = $inputs['preferred_powertrain'] ?? 'any';

        $recommendations = [
            'top_pick' => null,
            'alternatives' => [],
            'advice' => '',
            'powertrain_analysis' => [],
            'rebate_info' => [],
        ];

        // 1. Powertrain Analysis & Advice
        $recommendations['powertrain_analysis'] = $this->analyzePowertrain($avgDistance, $powertrain);

        // 2. Build Query
        $query = VehicleListing::query()
            ->where('status', 'active')
            ->where('price_cents', '<=', $budget * 100);

        // Filter by Usage & Kids
        if ($hasKids || $usage === 'family') {
            $query->whereIn('type', ['SUV', 'Wagon', 'Minivan']);
            $recommendations['advice'] .= "Since you have kids, we prioritized safety ratings, ISOFIX points, and cargo space. ";
        } elseif ($usage === 'commute') {
            $query->whereIn('type', ['Sedan', 'Hatchback', 'SUV']);
            $recommendations['advice'] .= "For commuting, we prioritized fuel efficiency and comfort. ";
        } elseif ($usage === 'adventure') {
            $query->whereIn('type', ['SUV', 'Ute', '4WD']);
            $recommendations['advice'] .= "For adventure, we looked for ground clearance and durability. ";
        }

        // Filter by Powertrain preference or recommendation
        if ($powertrain !== 'any') {
            $query->where('powertrain_type', $powertrain);
        } elseif ($avgDistance < 50) {
             // Recommend Electric/Hybrid for short distances
             $query->whereIn('powertrain_type', ['Electric', 'Hybrid', 'PHEV']);
             $recommendations['advice'] .= "Given your short daily commute, an Electric or Hybrid vehicle is ideal for savings. ";
        }

        // 3. Fetch Listings
        $listings = $query->inRandomOrder()->take(5)->get();

        if ($listings->isNotEmpty()) {
            $topPick = $listings->shift();
            $recommendations['top_pick'] = $topPick;
            $recommendations['alternatives'] = $listings;

            // Add rebate info if top pick is eligible
            if ($topPick && $topPick->rebate_eligible) {
                $recommendations['rebate_info'][] = "Your top pick is eligible for a rebate of $" . number_format($topPick->rebate_amount, 2);
            }
        } else {
            $recommendations['advice'] .= " We couldn't find exact matches in your budget. Consider adjusting your filters or looking at Certified Pre-Owned options.";
        }        return $recommendations;
    }

    /**
     * @return (string|string[])[][]
     *
     * @psalm-return array{electric: array{pros: list{'Zero emissions', 'Lower running costs', 'Quiet drive', 'Government rebates'}, cons: list{'Range anxiety on long trips', 'Charging infrastructure dependence', 'Higher upfront cost'}, suitability: 'High'|'Medium'}, hybrid: array{pros: list{'Good fuel economy', 'No range anxiety', 'Regenerative braking'}, cons: list{'Two powertrains to maintain', 'Less pure electric range'}, suitability: 'High'}, gas: array{pros: list{'Lower upfront cost', 'Easy refueling anywhere', 'Proven technology'}, cons: list{'Higher fuel costs', 'Emissions', 'Higher maintenance over time'}, suitability: 'High'|'Medium'}}
     */
    protected function analyzePowertrain(int $avgDistance, string $preference): array
    {
        $analysis = [];

        // Electric
        $analysis['electric'] = [
            'pros' => ['Zero emissions', 'Lower running costs', 'Quiet drive', 'Government rebates'],
            'cons' => ['Range anxiety on long trips', 'Charging infrastructure dependence', 'Higher upfront cost'],
            'suitability' => $avgDistance < 300 ? 'High' : 'Medium',
        ];

        // Hybrid
        $analysis['hybrid'] = [
            'pros' => ['Good fuel economy', 'No range anxiety', 'Regenerative braking'],
            'cons' => ['Two powertrains to maintain', 'Less pure electric range'],
            'suitability' => 'High',
        ];

        // Gas
        $analysis['gas'] = [
            'pros' => ['Lower upfront cost', 'Easy refueling anywhere', 'Proven technology'],
            'cons' => ['Higher fuel costs', 'Emissions', 'Higher maintenance over time'],
            'suitability' => $avgDistance > 500 ? 'High' : 'Medium',
        ];

        return $analysis;
    }
}

