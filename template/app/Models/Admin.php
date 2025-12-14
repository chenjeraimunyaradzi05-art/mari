<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $image
 * @property string $email
 * @property string|null $auth0_sub
 * @property \Illuminate\Support\Carbon|null $auth0_last_login_at
 * @property \Illuminate\Support\Carbon|null $auth0_session_refreshed_at
 * @property \Illuminate\Support\Carbon|null $mfa_verified_at
 * @property array<array-key, mixed>|null $auth0_profile
 * @property string|null $last_login_ip
 * @property string|null $last_login_user_agent
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AdminNotification> $notifications
 * @property int|null notifications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Spatie\Permission\Models\Permission> $permissions
 * @property int|null permissions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Spatie\Permission\Models\Role> $roles
 * @property int|null roles_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property int|null tokens_count
 *
 * @method static \Database\Factories\AdminFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin permission($permissions, $without = false)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin role($roles, $guard = null, $without = false)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereAuth0LastLoginAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereAuth0Profile($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereAuth0SessionRefreshedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereAuth0Sub($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereEmailVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereLastLoginIp($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereLastLoginUserAgent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereMfaVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin wherePassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereRememberToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin withoutPermission($permissions)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Admin withoutRole($roles, $guard = null)
 *
 * @mixin \Eloquent
 */
final class Admin extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    protected $guard_name = 'admin';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'auth0_sub',
        'auth0_last_login_at',
        'auth0_session_refreshed_at',
        'mfa_verified_at',
        'auth0_profile',
        'last_login_ip',
        'last_login_user_agent',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'auth0_last_login_at' => 'datetime',
        'auth0_session_refreshed_at' => 'datetime',
        'mfa_verified_at' => 'datetime',
        'auth0_profile' => 'array',
    ];

    public function hasVerifiedMfa(): bool
    {
        return $this->mfa_verified_at !== null;
    }

    public function markAuth0Login(array $profile, array $sessionMeta = []): void
    {
        $this->forceFill([
            'auth0_sub' => $profile['sub'] ?? $this->auth0_sub,
            'name' => $profile['name'] ?? $this->name,
            'email' => $profile['email'] ?? $this->email,
            'auth0_last_login_at' => now(),
            'auth0_session_refreshed_at' => now(),
            'auth0_profile' => $profile,
            'last_login_ip' => $sessionMeta['ip'] ?? $this->last_login_ip,
            'last_login_user_agent' => $sessionMeta['user_agent'] ?? $this->last_login_user_agent,
        ])->save();

        if (! empty($sessionMeta['mfa_verified']) && ! $this->mfa_verified_at) {
            $this->forceFill(['mfa_verified_at' => now()])->save();
        }
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(AdminNotification::class);
    }

    public function loginAudits(): HasMany
    {
        return $this->hasMany(AdminLoginAudit::class, 'admin_id');
    }

    /**
     * Admin users don't go through the normal primary-purpose onboarding flow.
     * Tests and middleware expect the method to exist when user model is an Admin,
     * so return true here to explicitly mark admins as having completed the step.
     */
    public function hasCompletedPrimaryPurpose(): bool
    {
        return true;
    }
}
