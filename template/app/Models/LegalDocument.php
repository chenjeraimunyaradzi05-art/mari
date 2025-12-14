<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $user_id
 * @property string $document_type
 * @property string $status
 * @property string|null $grant_pack
 * @property array<array-key, mixed>|null $wizard_payload
 * @property array<array-key, mixed>|null $metadata
 * @property string|null $storage_path
 * @property string|null $preview_hash
 * @property string|null $context_token
 * @property int $version
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereContextToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereDocumentType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereGrantPack($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument wherePreviewHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereStoragePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|LegalDocument whereWizardPayload($value)
 *
 * @mixin \Eloquent
 */
final class LegalDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'user_id',
        'document_type',
        'status',
        'grant_pack',
        'wizard_payload',
        'metadata',
        'storage_path',
        'preview_hash',
        'context_token',
        'version',
    ];

    protected $casts = [
        'wizard_payload' => 'array',
        'metadata' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $document): void {
            if (! $document->uuid) {
                $document->uuid = (string) Str::uuid();
            }

            if (! $document->version) {
                $document->version = 1;
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function incrementVersion(): void
    {
        $this->version = (int) $this->version + 1;
        $this->save();
    }

    public function storageDirectory(): string
    {
        return dirname((string) $this->storage_path);
    }

    public function filename(string $format = 'pdf'): string
    {
        $slug = Str::slug($this->document_type.'-'.$this->uuid);

        return sprintf('%s-v%s.%s', $slug, $this->version, $format);
    }
}
