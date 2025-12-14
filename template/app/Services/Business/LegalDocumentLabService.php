<?php

namespace App\Services\Business;

use App\Models\LegalDocument;
use App\Models\User;
use App\Services\AiContextHistoryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Html as WordHtml;

final class LegalDocumentLabService
{


    public function documents(): array
    {
        return config('legal_document_lab.documents', []);
    }

    public function document(string $type): ?array
    {
        return $this->documents()[$type] ?? null;
    }

    public function wizard(string $key): array
    {
        return config("legal_document_lab.wizard.{$key}", []);
    }

    public function grantPacks(): array
    {
        return $this->grantPackManifest()['packs'] ?? [];
    }

    public function disclaimer(): string
    {
        return (string) config('legal_document_lab.disclaimer');
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function generatePreview(string $documentType, array $payload, ?User $user = null, ?string $grantPack = null): string
    {
        $document = $this->document($documentType);

        if (! $document) {
            return '<p class="text-red-600">Unknown document type selected.</p>';
        }

        $view = $document['template_view'];

        $data = [
            'payload' => $payload,
            'user' => $user,
            'grant_pack' => $this->grantPacks()[$grantPack] ?? null,
            'document' => $document,
            'disclaimer' => $this->disclaimer(),
        ];

        return view($view, $data)->render();
    }

    public function export(LegalDocument $document, string $format): string
    {
        $format = strtolower($format);
        $html = $this->generatePreview(
            $document->document_type,
            $document->wizard_payload ?? [],
            $document->user,
            $document->grant_pack
        );

        $disk = $this->disk();
        $directory = $this->documentDirectory($document->user_id, $document->document_type);
        $filename = $document->filename($format);
        $path = "$directory/$filename";

        if ($format === 'pdf') {
            $pdf = Pdf::loadHTML($html);
            $disk->put($path, $pdf->output());
        } elseif ($format === 'docx') {
            $phpWord = new PhpWord();
            $section = $phpWord->addSection();
            WordHtml::addHtml($section, $html, false, false);
            $temp = tmpfile();
            $meta = stream_get_meta_data($temp);
            $tempPath = $meta['uri'];
            IOFactory::createWriter($phpWord, 'Word2007')->save($tempPath);
            $disk->put($path, file_get_contents($tempPath) ?: '');
            fclose($temp);
        } else {
            throw new \InvalidArgumentException('Unsupported format: '.$format);
        }

        $document->forceFill([
            'status' => 'exported',
            'storage_path' => $path,
        ])->save();

        return $path;
    }

    public function disk(): FilesystemAdapter
    {
        return Storage::disk(config('legal_document_lab.storage.disk', 'local'));
    }

    private function documentDirectory(int $userId, string $documentType): string
    {
        $base = trim(config('legal_document_lab.storage.base_path', 'legal-documents'), '/');

        return sprintf('%s/%s/%s', $base, $userId, Str::slug($documentType));
    }

    /**
     * @return (array|string)[]
     *
     * @psalm-return array{packs: array, synced_at: string, source: string, etag: string}
     */
    public function refreshGrantPacks(?string $feedUrl = null): array
    {
        $feedUrl = $feedUrl ?: (string) Arr::get(config('legal_document_lab.grant_pack_feed', []), 'url', '');

        if ($feedUrl === '') {
            throw new \RuntimeException('No grant pack feed URL configured.');
        }

        $response = Http::timeout($this->grantPackFeedTimeout())
            ->acceptJson()
            ->get($feedUrl);

        $payload = $response->json();

        if (! is_array($payload)) {
            throw new \RuntimeException('Unexpected grant pack feed payload.');
        }

        $packs = $payload['grant_packs'] ?? [];

        if (! is_array($packs) || empty($packs)) {
            throw new \RuntimeException('Grant pack feed returned no packs.');
        }

        $manifest = [
            'packs' => $packs,
            'synced_at' => now()->toIso8601String(),
            'source' => $feedUrl,
            'etag' => $response->header('ETag'),
        ];

        $this->writeGrantPackCache($manifest);

        return $manifest;
    }

    public function recordAiContext(
        ?User $user,
        string $action,
        string $documentType,
        array $payload,
        ?string $grantPack,
        string $html,
        ?LegalDocument $document = null
    ): ?string {
        if (! $user || ! $this->aiContextLoggingEnabled()) {
            return null;
        }

        try {
            $contextPayload = [
                'document_type' => $documentType,
                'grant_pack' => $grantPack,
                'wizard_payload' => $payload,
                'html_preview' => Str::limit(strip_tags($html), 4000),
                'action' => $action,
                'document_uuid' => $document?->uuid,
            ];

            // Resolve the AI context history service from the container so tests may
            // bind a mock instance. Older code referenced a missing property.
            $context = app(AiContextHistoryService::class)->store($user->id, $this->aiContextKey(), [
                'selection_preview' => $this->buildPreviewFields($payload),
                'selection_total' => count($payload),
                'prompt' => sprintf(
                    '%s %s (%s)',
                    Str::headline($documentType),
                    $action,
                    $grantPack ?: 'base pack'
                ),
                'context_payload' => json_encode($contextPayload, JSON_UNESCAPED_SLASHES),
                'surface' => $this->aiContextSurface(),
            ]);

            return $context->token;
        } catch (\Throwable $exception) {
            Log::channel(config('ai.observability.log_channel', 'stack'))
                ->warning('legal_document_lab.ai_context_failed', [
                    'message' => $exception->getMessage(),
                    'document_type' => $documentType,
                ]);

            return null;
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function buildPreviewFields(array $payload): array
    {
        $limit = max(1, (int) Arr::get(config('legal_document_lab.ai_context_logging', []), 'max_preview_fields', 6));

        return collect($payload)
            ->map(fn ($value, $key) => sprintf('%s: %s', Str::headline((string) $key), is_scalar($value) ? (string) $value : '[complex]'))
            ->filter()
            ->take($limit)
            ->values()
            ->all();
    }

    private function aiContextLoggingEnabled(): bool
    {
        return (bool) Arr::get(config('legal_document_lab.ai_context_logging', []), 'enabled', true);
    }

    private function aiContextSurface(): string
    {
        return (string) Arr::get(config('legal_document_lab.ai_context_logging', []), 'surface', 'legal_document_lab');
    }

    private function aiContextKey(): string
    {
        return (string) Arr::get(config('legal_document_lab.ai_context_logging', []), 'context_key', 'legal-document-lab');
    }

    private function grantPackManifest(): array
    {
        $cache = $this->readGrantPackCache();

        if ($cache) {
            return $cache;
        }

        return [
            'packs' => config('legal_document_lab.grant_packs', []),
            'synced_at' => null,
            'source' => 'config/legal_document_lab.php',
        ];
    }

    /**
     * @psalm-return array{packs: mixed,...}|null
     */
    private function readGrantPackCache(): array|null
    {
        $path = $this->grantPackCachePath();

        if (! Storage::disk('local')->exists($path)) {
            return null;
        }

        $contents = Storage::disk('local')->get($path);
        $decoded = json_decode($contents, true);

        if (! is_array($decoded) || empty($decoded['packs'])) {
            return null;
        }

        return $decoded;
    }

    private function writeGrantPackCache(array $manifest): void
    {
        Storage::disk('local')->put(
            $this->grantPackCachePath(),
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    private function grantPackCachePath(): string
    {
        return (string) Arr::get(config('legal_document_lab.grant_pack_feed', []), 'cache_path', 'legal-document-lab/grant-packs.cache.json');
    }

    /**
     * @psalm-return int<3, max>
     */
    private function grantPackFeedTimeout(): int
    {
        return max(3, (int) Arr::get(config('legal_document_lab.grant_pack_feed', []), 'timeout', 10));
    }

    private function readGrantPackManifest(string $path): array
    {
        if (! File::exists($path)) {
            return [];
        }

        $decoded = json_decode(File::get($path), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Load the assets associated with a grant pack slug.
     *
     * Looks for a manifest at resources/legal/grant-packs/{slug}/manifest.json and
     * loads referenced asset files alongside the manifest.
     *
     * @return array<int, array<string, mixed>>
     */
    public function grantPackAssets(string $slug): array
    {
        $manifestPath = base_path(sprintf('resources/legal/grant-packs/%s/manifest.json', $slug));

        $manifest = $this->readGrantPackManifest($manifestPath);

        $assets = $manifest['assets'] ?? [];

        return collect($assets)
            ->map(function (array $asset) use ($slug) {
                $filename = $asset['filename'] ?? null;
                $content = '';

                if ($filename) {
                    $contentPath = base_path(sprintf('resources/legal/grant-packs/%s/%s', $slug, $filename));
                    if (File::exists($contentPath)) {
                        $content = File::get($contentPath);
                    }
                }

                $asset['content'] = $content;

                return $asset;
            })
            ->values()
            ->all();
    }

    /**
     * Create and persist a draft of a legal document, save the preview HTML to disk,
     * and optionally record an AI context token.
     */
    public function storeDraft(User $user, string $documentType, array $payload, ?string $grantPack, string $html): LegalDocument
    {
        $disk = $this->disk();
        $directory = $this->documentDirectory($user->id, $documentType);

        $document = LegalDocument::query()->create([
            'user_id' => $user->id,
            'document_type' => $documentType,
            'status' => 'draft',
            'grant_pack' => $grantPack,
            'wizard_payload' => $payload,
        ]);

        $filename = $document->filename('html');
        $path = sprintf('%s/%s', $directory, $filename);

        $disk->put($path, $html);

        $contextToken = null;

        if ($this->aiContextLoggingEnabled()) {
            try {
                $context = app(AiContextHistoryService::class)->store($user->id, $this->aiContextKey(), [
                    'selection_preview' => $this->buildPreviewFields($payload),
                    'selection_total' => count($payload),
                    'prompt' => sprintf('%s %s (%s)', Str::headline($documentType), 'save_draft', $grantPack ?: 'base pack'),
                    'context_payload' => json_encode([
                        'document_type' => $documentType,
                        'grant_pack' => $grantPack,
                        'wizard_payload' => $payload,
                        'html_preview' => Str::limit(strip_tags($html), 4000),
                    ], JSON_UNESCAPED_SLASHES),
                    'surface' => $this->aiContextSurface(),
                ]);

                $contextToken = $context->token ?? null;
            } catch (\Throwable $exception) {
                Log::channel(config('ai.observability.log_channel', 'stack'))
                    ->warning('legal_document_lab.ai_context_failed', [
                        'message' => $exception->getMessage(),
                        'document_type' => $documentType,
                    ]);
            }
        }

        $document->forceFill([
            'storage_path' => $path,
            'context_token' => $contextToken,
        ])->save();

        return $document;
    }
}

