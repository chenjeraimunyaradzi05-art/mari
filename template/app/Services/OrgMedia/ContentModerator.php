<?php

namespace App\Services\OrgMedia;

use App\Models\OrgMediaAsset;
use Aws\Rekognition\RekognitionClient;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ContentModerator
{
    /**
     * @return (array|string)[]
     *
     * @psalm-return array{status: string, labels: list<non-empty-mixed>, summary: string}
     */
    public function analyze(OrgMediaAsset $asset): array
    {
        $result = [
            'status' => 'approved',
            'labels' => [],
            'summary' => null,
        ];

        $summaries = [];
        $status = 'approved';

        if ($asset->type === 'video') {
            $visualResult = $this->assessVisualContent($asset);
            $result['labels'] = array_merge($result['labels'], $visualResult['labels']);
            $summaries[] = $visualResult['summary'];
            $status = $this->chooseStatus($status, $visualResult['status']);
        }

        $textualResult = $this->assessTextualContent($asset);
        $result['labels'] = array_merge($result['labels'], $textualResult['labels']);
        $summaries[] = $textualResult['summary'];
        $status = $this->chooseStatus($status, $textualResult['status']);

        $result['status'] = $status;
        $result['labels'] = array_values(array_unique(array_filter($result['labels'])));
        $result['summary'] = implode(' ', array_filter(array_unique($summaries)));

        return $result;
    }

    /**
     * @return (null|string|string[])[]
     *
     * @psalm-return array{labels: list<non-falsy-string>, summary: null|string, status: 'approved'|'flagged'|'needs_review'}
     */
    private function assessVisualContent(OrgMediaAsset $asset): array
    {
        $labels = [];
        $summary = null;
        $status = 'approved';
        $threshold = max(0.0, min(1.0, (float) config('org.moderation.confidence_threshold', 0.7)));
        $minConfidence = $threshold * 100;
        $flaggedLabels = array_map('strtolower', config('org.moderation.flagged_labels', []));
        $disk = Storage::disk($asset->disk);
        $thumbnailPath = $asset->thumbnail_path;

        if (! $thumbnailPath || ! $disk->exists($thumbnailPath)) {
            return compact('labels', 'summary', 'status');
        }

        $rekognition = $this->rekognitionClient();

        if (! $rekognition) {
            $summary = 'Visual moderation skipped (AWS Rekognition not configured).';
            $status = 'needs_review';

            return compact('labels', 'summary', 'status');
        }

        try {
            $response = $rekognition->detectModerationLabels([
                'Image' => ['Bytes' => $disk->get($thumbnailPath)],
                'MinConfidence' => $minConfidence,
            ]);

            $moderationLabels = $response['ModerationLabels'] ?? [];

            foreach ($moderationLabels as $moderationLabel) {
                $name = $moderationLabel['Name'] ?? null;
                $confidence = (float) ($moderationLabel['Confidence'] ?? 0);

                if (! $name) {
                    continue;
                }

                $labels[] = $name.' ('.round($confidence).'% )';
                $lowerName = Str::lower($name);

                if ($confidence >= $minConfidence && (empty($flaggedLabels) || in_array($lowerName, $flaggedLabels, true))) {
                    $status = 'flagged';
                    $summary = 'Detected disallowed visual content: '.$name.' with '.round($confidence)."% confidence.";
                    break;
                }

                if ($status !== 'flagged' && $confidence >= ($minConfidence - 10)) {
                    $status = 'needs_review';
                    $summary = 'Potentially sensitive visual content: '.$name.' ('.round($confidence).'%).';
                }
            }
        } catch (\Throwable $exception) {
            Log::warning('Visual moderation failed', [
                'media_id' => $asset->id,
                'message' => $exception->getMessage(),
            ]);

            $status = 'needs_review';
            $summary = 'Visual moderation could not be completed automatically.';
        }

        return compact('labels', 'summary', 'status');
    }

    /**
     * @return ((int|string)[]|null|string)[]
     *
     * @psalm-return array{labels: list{0?: array-key,...}, summary: null|string, status: 'approved'|'flagged'|'needs_review'}
     */
    private function assessTextualContent(OrgMediaAsset $asset): array
    {
        $labels = [];
        $summary = null;
        $status = 'approved';
        $disk = Storage::disk($asset->disk);
        $textualPayload = $this->collectTextPayload($asset, $disk);

        if (blank($textualPayload)) {
            return compact('labels', 'summary', 'status');
        }

        $apiKey = config('org.moderation.openai.api_key');
        $model = config('org.moderation.openai.model', 'omni-moderation-latest');

        if ($apiKey) {
            try {
                $response = Http::timeout(15)
                    ->withToken($apiKey)
                    ->acceptJson()
                    ->post('https://api.openai.com/v1/moderations', [
                        'model' => $model,
                        'input' => Str::limit($textualPayload, 7000, ''),
                    ]);

                if ($response->failed()) {
                    throw new \RuntimeException('OpenAI moderation API responded with an error.');
                }

                $result = Arr::first($response->json('results', []), []);

                if (Arr::get($result, 'flagged')) {
                    $flaggedCategories = array_keys(array_filter(Arr::get($result, 'categories', [])));
                    $labels = array_merge($labels, $flaggedCategories);
                    $status = 'flagged';
                    $summary = 'Textual content rejected by moderation: '.implode(', ', $flaggedCategories).'.';
                }
            } catch (\Throwable $exception) {
                Log::warning('OpenAI textual moderation failed', [
                    'media_id' => $asset->id,
                    'message' => $exception->getMessage(),
                ]);

                $status = 'needs_review';
                $summary = 'Textual moderation could not be completed automatically.';
            }
        }

        if ($status === 'approved') {
            $blocklist = array_filter(config('org.moderation.blocklist', []));
            $lowerText = Str::lower($textualPayload);

            foreach ($blocklist as $term) {
                $term = Str::lower($term);

                if ($term && Str::contains($lowerText, $term)) {
                    $labels[] = $term;
                    $status = 'needs_review';
                    $summary = 'Flagged for manual review due to presence of sensitive keyword: '.$term.'.';
                    break;
                }
            }
        }

        return compact('labels', 'summary', 'status');
    }

    private function collectTextPayload(OrgMediaAsset $asset, Filesystem $disk): string
    {
        $chunks = [];

        if ($asset->captions_path && $disk->exists($asset->captions_path)) {
            $chunks[] = $disk->get($asset->captions_path);
        }

        $description = Arr::get($asset->meta ?? [], 'description');

        if (! blank($description)) {
            $chunks[] = $description;
        }

        $transcript = Arr::get($asset->meta ?? [], 'transcript');

        if (! blank($transcript)) {
            $chunks[] = $transcript;
        }

        return (string) Str::of(implode("\n\n", $chunks))->stripTags()->squish();
    }

    private function chooseStatus(string $current, string $candidate): string
    {
        if ($candidate === 'flagged') {
            return 'flagged';
        }

        if ($candidate === 'needs_review' && $current !== 'flagged') {
            return 'needs_review';
        }

        return $current;
    }

    private function rekognitionClient(): ?RekognitionClient
    {
        if (config('org.moderation.provider') !== 'aws') {
            return null;
        }

        try {
            return new RekognitionClient([
                'region' => env('AWS_REGION', 'us-east-1'),
                'version' => 'latest',
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Unable to instantiate AWS Rekognition client', [
                'message' => $exception->getMessage(),
            ]);

            return null;
        }
    }
}

