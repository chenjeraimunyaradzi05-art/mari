<?php

namespace App\Services\Mortgage;

final class MortgageScoringService
{
    /**
     * Score a mortgage application based on provided data.
     *
     * @param array $applicationData
     *
     * @return int Score value
     *
     * @psalm-return int<50, 100>
     */
    public function score(array $applicationData): int
    {
        // TODO: Implement scoring logic (e.g., credit, income, property value)
        // Example: return a score between 0 and 100
        return rand(50, 100); // Placeholder
    }
}

