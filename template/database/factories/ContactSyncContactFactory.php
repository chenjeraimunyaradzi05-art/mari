<?php

namespace Database\Factories;

use App\Models\ContactSyncContact;
use App\Models\ContactSyncSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\ContactSyncContact>
 */
final class ContactSyncContactFactory extends Factory
{
    protected $model = ContactSyncContact::class;

    #[\Override]
    /**
     * @return (ContactSyncSessionFactory|UserFactory|null|string|string[])[]
     *
     * @psalm-return array{session_id: ContactSyncSessionFactory, user_id: UserFactory, hash: string, type: 'email', matched_user_id: null, metadata: array{domain: 'example.test'}}
     */
    public function definition(): array
    {
        return [
            'session_id' => ContactSyncSession::factory(),
            'user_id' => User::factory(),
            'hash' => hash('sha256', Str::uuid()->toString()),
            'type' => 'email',
            'matched_user_id' => null,
            'metadata' => ['domain' => 'example.test'],
        ];
    }
}

