<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class PronounLintCommand extends Command
{
    protected $signature = 'pronoun:lint
        {--path=* : Limit the scan to one or more relative paths}
        {--extensions=php,blade.php,js,ts,vue,json,md : File extensions to include}
        {--allow= : Comma separated list of words to ignore}
        {--quiet-output : Suppress the detailed table and only report pass/fail}';

    protected $description = 'Scan source files for masculine-coded pronouns and fail if any are detected.';

    private Filesystem $files;

    private array $defaultPaths = [
        'resources/views',
        'resources/lang',
        'resources/js',
        'resources/md',
    ];

    private array $defaultTerms = [
        'he',
        'him',
        'his',
        'himself',
        'mankind',
        'manpower',
        'man-hours',
        'gentlemen',
        'guys',
    ];

    private function shouldCheckFile(string $path, Collection $extensions): bool
    {
        if ($extensions->isEmpty()) {
            return true;
        }

        return $extensions->contains(fn ($extension) => Str::endsWith($path, '.'.$extension));
    }

    private function buildRegex(Collection $allowList): string
    {
        $terms = collect($this->defaultTerms)
            ->reject(fn ($term) => $allowList->contains(Str::lower($term)))
            ->map(fn ($term) => preg_quote($term, '/'))
            ->values()
            ->implode('|');

        return '/\b('.$terms.')\b/i';
    }

    /**
     * @psalm-return Collection<never, never>
     */
    private function scanFile(string $path, string $regex): Collection
    {
        $hits = collect();
        $lines = @file($path, FILE_IGNORE_NEW_LINES);

        if (! $lines) {
            return $hits;
        }

        foreach ($lines as $number => $content) {
            if (! preg_match_all($regex, $content, $matches)) {
                continue;
            }

            foreach ($matches[0] as $term) {
                $hits->push([
                    'file' => $path,
                    'line' => $number + 1,
                    'term' => trim($term),
                    'excerpt' => Str::limit(trim($content), 140),
                ]);
            }
        }

        return $hits;
    }
}

