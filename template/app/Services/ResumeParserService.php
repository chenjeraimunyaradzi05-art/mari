<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\Skill;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser as PdfParser;
use Throwable;
use ZipArchive;

final class ResumeParserService
{
    private ?Collection $skillInventory = null;

    /**
     * @return (array|int|mixed|string)[]
     *
     * @psalm-return array{summary: string, contacts: array, skills: array, experience: mixed, experience_detailed: mixed, education: mixed, education_detailed: mixed, certifications: array, languages: array, achievements: array, confidence: int, raw_text: string}
     */
    public function parse(UploadedFile $file, ?Candidate $candidate = null): array
    {
        $text = $this->normaliseText($this->extractText($file));

        $sections = $this->segmentSections($text);

        $contacts = $this->detectContacts($text);
        $skills = $this->detectSkills($sections['skills'] ?? '', $text, $candidate);
        $experience = $this->detectExperience($sections);
        $education = $this->detectEducation($sections);
        $certifications = $this->detectCertifications($sections);
        $languages = $this->detectLanguages($sections);
        $achievements = $this->detectAchievements($sections);

        $confidence = $this->calculateConfidence([
            'summary' => $sections['summary'] ?? '',
            'contacts' => $contacts,
            'skills' => $skills,
            'experience' => $experience['entries'],
            'education' => $education['entries'],
        ]);

        return [
            'summary' => $this->buildSummary($sections, $text, $candidate, $skills, $experience['entries'], $achievements),
            'contacts' => $contacts,
            'skills' => $skills,
            'experience' => $experience['highlights'],
            'experience_detailed' => $experience['entries'],
            'education' => $education['highlights'],
            'education_detailed' => $education['entries'],
            'certifications' => $certifications,
            'languages' => $languages,
            'achievements' => $achievements,
            'confidence' => $confidence,
            'raw_text' => Str::limit($text, 20000),
        ];
    }

    private function extractText(UploadedFile $file): string
    {
        $mime = $file->getMimeType() ?? '';

        try {
            if (Str::contains($mime, 'pdf')) {
                return $this->parsePdf($file);
            }

            if (Str::contains($mime, 'wordprocessingml')) {
                return $this->parseDocx($file);
            }

            if ($mime === 'application/msword') {
                return $this->parseLegacyDoc($file);
            }

            if (Str::startsWith($mime, 'text/')) {
                return (string) file_get_contents($file->getRealPath());
            }
        } catch (Throwable $throwable) {
            report($throwable);
        }

        return (string) @file_get_contents($file->getRealPath());
    }

    private function parsePdf(UploadedFile $file): string
    {
        try {
            $pdf = $this->pdfParser->parseFile($file->getRealPath());
            $text = $pdf?->getText();

            return $text ? Str::ascii($text) : '';
        } catch (Throwable $throwable) {
            report($throwable);
        }

        return '';
    }

    private function parseDocx(UploadedFile $file): string
    {
        $zip = new ZipArchive();
        $text = '';

        if ($zip->open($file->getRealPath()) === true) {
            $index = $zip->locateName('word/document.xml');
            if ($index !== false) {
                $data = $zip->getFromIndex($index);
                if ($data !== false) {
                    $text = strip_tags(str_replace(['</w:p>', '</w:tr>'], "\n", $data));
                }
            }
            $zip->close();
        }

        return Str::ascii($text);
    }

    private function parseLegacyDoc(UploadedFile $file): string
    {
        $content = (string) file_get_contents($file->getRealPath());

        return Str::ascii(Str::replace(["\r", "\0"], ' ', $content));
    }

    private function normaliseText(string $text): string
    {
        return Str::of($text)
            ->replace(["\r"], "\n")
            ->replaceMatches('/\n{3,}/', "\n\n")
            ->replaceMatches('/[\t\x0B\f]+/', ' ')
            ->toString();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<string, string>
     */
    private function segmentSections(string $text): array
    {
        $lines = preg_split('/\n+/', $text);
        $sections = [];
        $currentKey = 'summary';
        $sections[$currentKey] = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '') {
                continue;
            }

            $heading = $this->detectHeading($trimmed);
            if ($heading) {
                $currentKey = $heading;
                $sections[$currentKey] = [];
                continue;
            }

            $sections[$currentKey][] = $trimmed;
        }

        return collect($sections)
            ->map(fn (array $lines) => implode("\n", $lines))
            ->all();
    }

    private function detectHeading(string $line): string|null
    {
        $normalized = Str::lower(Str::replace([':', '.'], '', $line));
        $normalized = Str::of($normalized)->replaceMatches('/[^a-z\s]/', '')->squish()->toString();

        $map = [
            'summary' => ['summary', 'professional summary', 'profile', 'about me'],
            'skills' => ['skills', 'core skills', 'technical skills', 'competencies', 'strengths'],
            'experience' => ['experience', 'work experience', 'professional experience', 'employment history'],
            'education' => ['education', 'academic history', 'qualifications'],
            'certifications' => ['certifications', 'licenses', 'certifications & training', 'training'],
            'projects' => ['projects', 'selected projects'],
            'languages' => ['languages', 'language proficiency'],
            'achievements' => ['achievements', 'awards'],
        ];

        foreach ($map as $section => $keywords) {
            if (in_array($normalized, $keywords, true)) {
                return $section;
            }

            foreach ($keywords as $keyword) {
                if (Str::contains($normalized, $keyword) && Str::length($normalized) <= Str::length($keyword) + 10) {
                    return $section;
                }
            }
        }

        if (Str::upper($line) === $line && Str::length($line) <= 32) {
            return Str::contains($line, 'EDUCATION') ? 'education' : null;
        }

        return null;
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array{email?: string, phone?: string, professional_profile?: string, github?: string, portfolio?: string, location?: mixed|string}
     */
    private function detectContacts(string $text): array
    {
        $contacts = [];

        if (preg_match('/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,7}/i', $text, $emailMatch)) {
            $contacts['email'] = Str::lower($emailMatch[0]);
        }

        if (preg_match('/\+?[0-9][0-9\-\s]{7,}/', $text, $phoneMatch)) {
            $contacts['phone'] = trim($phoneMatch[0]);
        }

        if (preg_match('/https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/(?:in|profile|profiles|people|members|u)\/[\w\-_%]+)?/i', $text, $match)) {
            $contacts['professional_profile'] = $match[0];
        }

        if (preg_match('/https?:\/\/(?:www\.)?github\.com\/[\w\-]+/i', $text, $match)) {
            $contacts['github'] = $match[0];
        }

        if (preg_match('/https?:\/\/[\w\.-]+\.[a-z]{2,5}\b[^\s]*/i', $text, $portfolio)) {
            $contacts['portfolio'] = $portfolio[0];
        }

        if (! array_key_exists('location', $contacts)) {
            if (preg_match('/\b([A-Z][a-z]+\s+(?:City|Town|Village|Region|State|Province)),?\s+([A-Z]{2}|[A-Z][a-z]+)/', $text, $location)) {
                $contacts['location'] = trim($location[0]);
            }
        }

        return $contacts;
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function detectSkills(string $skillsSection, string $fullText, ?Candidate $candidate): array
    {
        $catalogue = $this->skillInventory();
        $skillText = Str::lower($skillsSection !== '' ? $skillsSection : $fullText);

        $discovered = $catalogue
            ->filter(fn (string $skill) => Str::contains($skillText, Str::lower($skill)))
            ->map(fn (string $skill) => Str::title($skill))
            ->values();

        if ($candidate && $candidate->skills->isNotEmpty()) {
            $candidateSkills = $candidate->skills
                ->map(fn ($pivot) => $pivot->skill?->name)
                ->filter()
                ->map(/**
                 * @param string $skill
                 */
                fn (string $skill) => Str::title($skill));

            $discovered = $discovered->merge($candidateSkills);
        }

        if ($skillsSection) {
            $tokens = collect(preg_split('/[,\n\|;]/', $skillsSection))
                ->map(fn ($token) => Str::title(trim($token)))
                ->filter(fn ($token) => Str::length($token) > 1 && Str::length($token) <= 40);

            $discovered = $discovered->merge($tokens);
        }

        return $discovered
            ->unique(fn ($skill) => Str::lower($skill))
            ->sort()
            ->values()
            ->take(30)
            ->all();
    }

    /**
     * @return (array|null|string)[][]
     *
     * @psalm-return array{entries: array<int, array|null>, highlights: array<int, string>}
     */
    private function detectExperience(array $sections): array
    {
        $raw = $sections['experience'] ?? '';
        $blocks = $raw !== '' ? preg_split('/\n{2,}/', $raw) : [];

        $entries = collect($blocks)
            ->map(fn (string $block) => $this->parseExperienceBlock($block))
            ->filter()
            ->values();

        if ($entries->isEmpty()) {
            $fallbackLines = collect(preg_split('/\n/', $raw))
                ->filter(fn ($line) => Str::contains(Str::lower($line), ['experience', 'managed', 'led', 'developed', 'implemented', 'responsible']))
                ->take(6)
                ->values();

            return [
                'entries' => [],
                'highlights' => $fallbackLines->all(),
            ];
        }

        $highlights = $entries
            ->map(function (array $entry) {
                $parts = array_filter([
                    $entry['role'] ?? null,
                    $entry['company'] ?? null,
                    $entry['duration'] ?? null,
                ]);

                return implode(' • ', $parts) . ($entry['summary'] ? ' — ' . $entry['summary'] : '');
            })
            ->take(6)
            ->all();

        return [
            'entries' => $entries->all(),
            'highlights' => $highlights,
        ];
    }

    /**
     * @return (Collection|null|string)[]|null
     *
     * @psalm-return array{role: Collection<int, string>|null|string, company: null|string, duration: null|string, summary: string}|null
     */
    private function parseExperienceBlock(string $block): array|null
    {
        $lines = collect(preg_split('/\n+/', trim($block)))
            ->map(fn ($line) => Str::squish($line))
            ->filter(fn ($line) => Str::length($line) > 2)
            ->values();

        if ($lines->isEmpty()) {
            return null;
        }

        $firstLine = $lines->shift();
        $durationLine = $lines->first(fn ($line) => $this->looksLikeDuration($line));

        if ($durationLine) {
            $lines = $lines->reject(fn ($line) => $line === $durationLine);
        }

        $company = null;
        $role = $firstLine;

        if (Str::contains($firstLine, ' at ')) {
            [$role, $company] = array_map('trim', explode(' at ', $firstLine, 2));
        } elseif ($lines->isNotEmpty()) {
            $possibleCompany = $lines->first(fn ($line) => Str::contains($line, ['Inc', 'LLC', 'Ltd', 'Company', 'Corp', 'Agency']));
            if ($possibleCompany) {
                $company = $possibleCompany;
                $lines = $lines->reject(fn ($line) => $line === $possibleCompany);
            }
        }

        $summary = $lines->take(2)->implode(' ');

        return [
            'role' => $role,
            'company' => $company,
            'duration' => $durationLine,
            'summary' => Str::limit($summary, 240),
        ];
    }

    private function looksLikeDuration(string $line): bool
    {
        return (bool) preg_match('/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|\d{4})[\w\s,.–-]*(Present|Current|\d{4})/i', $line);
    }

    /**
     * @return ((Collection&Collection&Collection&Collection|string)[]|null|string)[][]
     *
     * @psalm-return array{entries: array<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>&Collection<int, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>&Collection<int<0, max>, array{degree?: Collection<int, string>&Collection<int<0, max>, string>|string, institution?: Collection<int, string>&Collection<int<0, max>, string>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>|string, duration?: string, notes?: string}|null>, highlights: array<int, string>}
     */
    private function detectEducation(array $sections): array
    {
        $raw = $sections['education'] ?? '';
        $blocks = $raw !== '' ? preg_split('/\n{2,}/', $raw) : [];

        $entries = collect($blocks)
            ->map(function (string $block) {
                $lines = collect(preg_split('/\n+/', trim($block)))
                    ->map(fn ($line) => Str::squish($line))
                    ->filter(fn ($line) => Str::length($line) > 2)
                    ->values();

                if ($lines->isEmpty()) {
                    return null;
                }

                $degree = $lines->shift();
                $institution = $lines->shift();
                $duration = $lines->first(fn ($line) => $this->looksLikeDuration($line));

                return array_filter([
                    'degree' => $degree,
                    'institution' => $institution,
                    'duration' => $duration,
                    'notes' => $lines->reject(fn ($line) => $line === $duration)->take(1)->implode(' '),
                ]);
            })
            ->filter()
            ->values();

        $highlights = $entries
            ->map(fn (array $entry) => implode(' • ', array_filter([
                $entry['degree'] ?? null,
                $entry['institution'] ?? null,
                $entry['duration'] ?? null,
            ])))
            ->take(4)
            ->all();

        return [
            'entries' => $entries->all(),
            'highlights' => $highlights,
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function detectCertifications(array $sections): array
    {
        $raw = $sections['certifications'] ?? '';
        if ($raw === '') {
            return [];
        }

        return collect(preg_split('/\n+/', $raw))
            ->map(fn ($line) => Str::squish($line))
            ->filter(fn ($line) => Str::length($line) > 2)
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function detectLanguages(array $sections): array
    {
        $raw = $sections['languages'] ?? '';
        if ($raw === '') {
            return [];
        }

        return collect(preg_split('/[,\n]+/', $raw))
            ->map(fn ($line) => Str::title(Str::squish($line)))
            ->filter(fn ($line) => Str::length($line) > 1)
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function detectAchievements(array $sections): array
    {
        $raw = $sections['achievements'] ?? $sections['projects'] ?? '';
        if ($raw === '') {
            return [];
        }

        return collect(preg_split('/\n+/', $raw))
            ->map(fn ($line) => Str::squish($line))
            ->filter(fn ($line) => Str::length($line) > 3)
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * @psalm-return int<0, 100>
     */
    private function calculateConfidence(array $data): int
    {
        $score = 0;

        if (! empty($data['summary'])) {
            $score += 20;
        }

        if (! empty($data['contacts'])) {
            $score += 20;
        }

        $score += min(20, count($data['skills'] ?? []) * 2);
        $score += min(20, count($data['experience'] ?? []) * 4);
        $score += min(20, count($data['education'] ?? []) * 5);

        return min(100, $score);
    }

    private function buildSummary(
        array $sections,
        string $text,
        ?Candidate $candidate,
        array $skills = [],
        array $experienceEntries = [],
        array $achievements = []
    ): string
    {
        $summarySection = $sections['summary'] ?? '';

        $caption = null;
        if ($summarySection !== '') {
            $caption = Str::of($summarySection)
                ->squish()
                ->substr(0, 220)
                ->append(Str::length($summarySection) > 220 ? '...' : '')
                ->toString();
        }

        if ($caption === null || $caption === '') {
            $sentences = preg_split('/(?<=[.!?])\s+/', Str::limit($text, 1000));
            $top = collect($sentences)
                ->map(fn ($sentence) => Str::squish($sentence))
                ->filter(fn ($sentence) => Str::length($sentence) > 20)
                ->take(2)
                ->implode(' ');

            if ($top !== '') {
                $caption = $top;
            }
        }

        $lines = collect();

        if ($candidate) {
            $name = $candidate->user?->name ?? $candidate->full_name;
            if ($name) {
                $slug = (string) Str::slug($name);
                if ($slug === '') {
                    $slug = 'talent';
                }
                $handle = '@' . Str::replace('-', '_', $slug);
                $lines->push($handle . ' | Career Highlights');
            }
        }

        if ($caption) {
            $lines->push($caption);
        }

        $featuredExperience = collect($experienceEntries)->first();
        if ($featuredExperience) {
            $parts = [];
            if (! empty($featuredExperience['role'])) {
                $parts[] = $featuredExperience['role'];
            }
            if (! empty($featuredExperience['company'])) {
                $parts[] = 'at ' . $featuredExperience['company'];
            }

            $experienceLine = $parts !== [] ? 'Now playing: ' . implode(' ', $parts) : null;
            if (! empty($featuredExperience['duration'])) {
                $experienceLine = ($experienceLine ?? 'Now playing:') . ' (' . $featuredExperience['duration'] . ')';
            }

            if (! empty($featuredExperience['summary'])) {
                $experienceLine = ($experienceLine ?? 'Now playing:') . ' - ' . Str::limit($featuredExperience['summary'], 140);
            }

            if ($experienceLine) {
                $lines->push($experienceLine);
            }
        }

        $hashtags = collect($skills)
            ->map(function ($skill) {
                $slug = Str::replace('-', '', Str::slug((string) $skill));
                return $slug !== '' ? '#' . $slug : null;
            })
            ->filter()
            ->unique()
            ->take(4)
            ->values();

        if ($hashtags->isNotEmpty()) {
            $lines->push('Skills on repeat: ' . $hashtags->implode(' '));
        }

        $achievement = collect($achievements)->first();
        if ($achievement) {
            $lines->push('Latest flex: ' . Str::limit($achievement, 140));
        }

        if ($lines->isEmpty()) {
            if ($candidate) {
                $nameSource = $candidate->user?->name ?? $candidate->full_name ?? '';
                $fallbackSlug = (string) Str::slug($nameSource);
                if ($fallbackSlug === '') {
                    $fallbackSlug = 'talent';
                }

                return sprintf(
                    '@%s | Resume captured. Drop a quick career update to help us spotlight you.',
                    Str::replace('-', '_', $fallbackSlug)
                );
            }

            return 'Profile feed saved. Add a headline and a few wins to unlock a more magnetic spotlight.';
        }

        return Str::of($lines->implode("\n"))
            ->trim()
            ->substr(0, 600)
            ->toString();
    }

    private function skillInventory(): Collection
    {
        if ($this->skillInventory !== null) {
            return $this->skillInventory;
        }

        $skills = Skill::query()
            ->pluck('name')
            ->filter()
            ->map(fn (string $skill) => Str::lower($skill))
            ->unique()
            ->values();

        $seed = collect(['leadership', 'communication', 'problem solving', 'php', 'laravel', 'python', 'react', 'vue', 'sql', 'aws', 'docker', 'kubernetes', 'project management', 'data analysis', 'machine learning']);

        $this->skillInventory = $skills->merge($seed)->unique()->values();

        return $this->skillInventory;
    }
}

