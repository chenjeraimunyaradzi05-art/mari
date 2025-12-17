<?php

namespace App\Auth;

use App\Models\Admin;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class Auth0UserProvider implements UserProvider
{
    public function __construct(private readonly Admin $model)
    {
    }

    #[\Override]
    /**
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, \Illuminate\Database\Eloquent\Model>|\Illuminate\Database\Eloquent\Model|null
     */
    public function retrieveById($identifier): \Illuminate\Database\Eloquent\Collection|\Illuminate\Database\Eloquent\Model|null
    {
        return $this->newModelQuery()->find($identifier);
    }

    #[\Override]
    public function retrieveByToken($identifier, $token): \Illuminate\Database\Eloquent\Model|null
    {
        if (!$token) {
            return null;
        }

        return $this->newModelQuery()
            ->whereKey($identifier)
            ->where('remember_token', $token)
            ->first();
    }

    #[\Override]
    public function updateRememberToken(Authenticatable $user, $token): void
    {
        if ($user instanceof Admin) {
            $user->setRememberToken($token);
            $user->save();
        }
    }

    #[\Override]
    public function retrieveByCredentials(array $credentials): \Illuminate\Database\Eloquent\Model|null
    {
        $query = $this->newModelQuery();

        if (!empty($credentials['auth0_sub'])) {
            $query->where('auth0_sub', $credentials['auth0_sub']);
        } elseif (!empty($credentials['email'])) {
            $query->where('email', $credentials['email']);
        } else {
            return null;
        }

        return $query->first();
    }

    #[\Override]
    public function validateCredentials(Authenticatable $user, array $credentials): bool
    {
        if (!empty($credentials['password'])) {
            return Hash::check($credentials['password'], $user->getAuthPassword());
        }

        return true;
    }

    #[\Override]
    public function rehashPasswordIfRequired(Authenticatable $user, array $credentials, bool $force = false): void
    {
        // Auth0 is the primary identity provider; nothing to rehash locally.
    }

    public function syncFromAuth0Profile(array $profile): ?Admin
    {
        $sub = Arr::get($profile, 'sub');
        $email = Arr::get($profile, 'email');

        $query = $this->newModelQuery();

        if ($sub) {
            $query->where('auth0_sub', $sub);
        } elseif ($email) {
            $query->where('email', $email);
        }

        $admin = $query->first();

        if (!$admin && $email) {
            $admin = $this->createModel()->newInstance();
            $admin->fill([
                'name' => Arr::get($profile, 'name', $email),
                'email' => $email,
                'auth0_sub' => $sub,
                'password' => Hash::make(Str::random(40)),
                'auth0_profile' => $profile,
            ]);
            $admin->save();
        }

        if ($admin) {
            $admin->markAuth0Login($profile);
        }

        return $admin;
    }

    /**
     * @psalm-return Builder<Admin>
     */
    protected function newModelQuery(): Builder
    {
        return $this->createModel()->newQuery();
    }

    protected function createModel(): Admin
    {
        return clone $this->model;
    }
}

