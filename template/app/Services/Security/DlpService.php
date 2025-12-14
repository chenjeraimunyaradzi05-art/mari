<?php

namespace App\Services\Security;

final class DlpService
{
    /** @var array<string, string> */
    private array $patterns = [
        'ssn' => '/\b\d{3}-\d{2}-\d{4}\b/u',
        'credit_card' => '/\b(?:\d{4}[-\s]?){3}\d{4}\b/u',
        'email' => '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u',
        'phone' => '/\b(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/u',
        'address' => '/\b\d{1,5}\s+[\p{L}0-9\s]+,\s*[A-Z]{2,3}\s+\d{3,6}\b/u',
        'medicare' => '/\b\d{4}\s?\d{5}\s?\d\b/u',
        'tfn' => '/\b\d{3}\s?\d{3}\s?\d{3}\b/u',
    ];

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{type: string, match: string, severity: string},...}
     */
    public function scan(string $content): array
    {
        $violations = [];

        foreach ($this->patterns as $type => $pattern) {
            if (preg_match_all($pattern, $content, $matches)) {
                foreach ($matches[0] as $match) {
                    $violations[] = [
                        'type' => $type,
                        'match' => $this->redact($match),
                        'severity' => $this->severity($type),
                    ];
                }
            }
        }

        return $violations;
    }

    private function redact(string $value): string
    {
        $length = mb_strlen($value);
        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        return mb_substr($value, 0, 2).'***'.mb_substr($value, -2);
    }

    private function severity(string $type): string
    {
        return match ($type) {
            'ssn', 'credit_card', 'medicare', 'tfn' => 'critical',
            'phone', 'address' => 'high',
            default => 'medium',
        };
    }

    private function mask(string $type): string
    {
        return match ($type) {
            'ssn', 'tfn' => '[REDACTED ID]',
            'credit_card' => '[REDACTED CARD]',
            'medicare' => '[REDACTED MEDICARE]',
            'phone' => '[REDACTED PHONE]',
            'address' => '[REDACTED ADDRESS]',
            'email' => '[REDACTED EMAIL]',
            default => '[REDACTED]',
        };
    }
}

