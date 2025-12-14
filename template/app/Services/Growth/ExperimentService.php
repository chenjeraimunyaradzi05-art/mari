<?php

namespace App\Services\Growth;

use App\Models\Growth\Experiment;
use App\Models\Growth\ExperimentAssignment;
use App\Models\Growth\ExperimentConversion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;

final class ExperimentService
{
    protected Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    /**
     * Get the visitor ID from cookie or create a new one.
     */
    public function getVisitorId(): string
    {
        $visitorId = $this->request->cookie('visitor_id');

        if (! $visitorId) {
            $visitorId = (string) Str::uuid();
            Cookie::queue('visitor_id', $visitorId, 60 * 24 * 365); // 1 year
        }

        return $visitorId;
    }

    /**
     * Get the assigned variant for an experiment.
     *
     * @param string $experimentName
     * @return string|null
     */
    public function getVariant(string $experimentName): ?string
    {
        $experiment = Experiment::where('name', $experimentName)
            ->where('status', 'active')
            ->first();

        if (! $experiment) {
            return null;
        }

        $visitorId = $this->getVisitorId();
        $userId = $this->request->user()?->id;

        // Check if already assigned
        $assignment = ExperimentAssignment::where('experiment_id', $experiment->id)
            ->where(function ($query) use ($visitorId, $userId) {
                $query->where('visitor_id', $visitorId);
                if ($userId) {
                    $query->orWhere('user_id', $userId);
                }
            })
            ->first();

        if ($assignment) {
            return $assignment->variant;
        }

        // Assign new variant
        $variant = $this->assignVariant($experiment);

        ExperimentAssignment::create([
            'experiment_id' => $experiment->id,
            'visitor_id' => $visitorId,
            'user_id' => $userId,
            'variant' => $variant,
        ]);

        return $variant;
    }

    /**
     * Assign a variant based on weights.
     *
     * @param Experiment $experiment
     * @return string
     */
    protected function assignVariant(Experiment $experiment): string
    {
        $variants = $experiment->variants;
        $weights = $experiment->weights;

        if (empty($weights)) {
            return $variants[array_rand($variants)];
        }

        $rand = mt_rand(1, 100);
        $cumulative = 0;

        foreach ($weights as $variant => $weight) {
            $cumulative += $weight;
            if ($rand <= $cumulative) {
                return $variant;
            }
        }

        return $variants[0];
    }

    /**
     * Track a conversion event.
     *
     * @param string $eventName
     * @param array $metadata
     * @return void
     */
    public function trackConversion(string $eventName, array $metadata = []): void
    {
        $visitorId = $this->getVisitorId();
        $userId = $this->request->user()?->id;

        // Find all active experiments this user is assigned to
        $assignments = ExperimentAssignment::whereHas('experiment', function ($query) {
            $query->where('status', 'active');
        })
        ->where(function ($query) use ($visitorId, $userId) {
            $query->where('visitor_id', $visitorId);
            if ($userId) {
                $query->orWhere('user_id', $userId);
            }
        })
        ->get();

        foreach ($assignments as $assignment) {
            ExperimentConversion::create([
                'experiment_id' => $assignment->experiment_id,
                'visitor_id' => $visitorId,
                'user_id' => $userId,
                'conversion_event' => $eventName,
                'metadata' => $metadata,
            ]);
        }
    }

    /**
     * Return experiment results summary (users, conversions, conversion_rate) and significance
     *
     * @param Experiment $experiment
     * @return array<string,mixed>
     */
    public function getResults(Experiment $experiment): array
    {
        $results = [];

        // Gather counts per variant
        foreach ($experiment->variants as $variant) {
            $visitorIds = ExperimentAssignment::where('experiment_id', $experiment->id)
                ->where('variant', $variant)
                ->pluck('visitor_id')
                ->toArray();

            $users = count($visitorIds);

            $conversions = 0;
            if (! empty($visitorIds)) {
                $conversions = ExperimentConversion::where('experiment_id', $experiment->id)
                    ->whereIn('visitor_id', $visitorIds)
                    ->count();
            }

            $conversionRate = $users > 0 ? (int) round(($conversions / $users) * 100) : 0;

            $results[$variant] = [
                'users' => $users,
                'conversions' => $conversions,
                'conversion_rate' => $conversionRate,
            ];
        }

        // Add statistical significance vs control (first variant)
        $control = $experiment->variants[0] ?? null;
        if ($control) {
            $n1 = $results[$control]['users'] ?? 0;
            $c1 = $results[$control]['conversions'] ?? 0;

            $sigs = [];
            foreach ($results as $variant => $data) {
                if ($variant === $control) continue;

                $n2 = $data['users'];
                $c2 = $data['conversions'];

                $sigs[$variant] = $this->calculateSignificance($n1, $c1, $n2, $c2);
            }

            $results['statistical_significance'] = $sigs;
        }

        return $results;
    }

    /**
     * Calculate statistical significance (Z-score and P-value).
     *
     * @param int $n1 Total users in control
     * @param int $c1 Conversions in control
     * @param int $n2 Total users in variant
     * @param int $c2 Conversions in variant
     *
     * @return (bool|float)[]
     *
     * @psalm-return array{z_score: float, p_value: float, is_significant: bool}
     */
    private function calculateSignificance(int $n1, int $c1, int $n2, int $c2): array
    {
        $p1 = $n1 > 0 ? $c1 / $n1 : 0;
        $p2 = $n2 > 0 ? $c2 / $n2 : 0;

        $pPool = ($n1 + $n2) > 0 ? ($c1 + $c2) / ($n1 + $n2) : 0;
        $sePool = sqrt($pPool * (1 - $pPool) * ((1 / ($n1 ?: 1)) + (1 / ($n2 ?: 1))));

        $zScore = $sePool > 0 ? ($p2 - $p1) / $sePool : 0;
        $pValue = 1 - $this->normalCDF(abs($zScore)); // Two-tailed test approximation

        return [
            'z_score' => round($zScore, 3),
            'p_value' => round($pValue, 4),
            'is_significant' => $pValue < 0.05, // 95% confidence
        ];
    }

    /**
     * Cumulative Distribution Function for Standard Normal Distribution.
     *
     * @param float $x
     * @return float
     */
    private function normalCDF(float $x): float
    {
        // Approximation of the error function
        $t = 1.0 / (1.0 + 0.2316419 * abs($x));
        $d = 0.3989422804014337 * exp(-$x * $x / 2.0);
        $prob = $d * $t * (0.319381530 + $t * (-0.356563782 + $t * (1.781477937 + $t * (-1.821255978 + $t * 1.330274429))));

        if ($x > 0) {
            return 1.0 - $prob;
        }
        return $prob;
    }
}

