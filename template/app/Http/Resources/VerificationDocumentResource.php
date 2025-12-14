<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\VerificationDocument */
final class VerificationDocumentResource extends JsonResource
{
    /**
     * @param Request $request
     */
    #[\Override]
    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{id: int, disk: string, path: string, mime_type: null|string, size_bytes: int|null, checksum: null|string, redacted_preview_path: null|string, metadata: array|null, created_at: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'disk' => $this->disk,
            'path' => $this->path,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'checksum' => $this->checksum,
            'redacted_preview_path' => $this->redacted_preview_path,
            'metadata' => $this->metadata,
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
