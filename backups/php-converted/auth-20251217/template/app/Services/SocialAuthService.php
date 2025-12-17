<?php

namespace App\Services;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\DatabaseManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Laravel\Socialite\AbstractUser;
use Laravel\Socialite\Contracts\Provider as SocialiteProvider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User as OAuthTwoUser;
use RuntimeException;

class SocialAuthService
{
	/** @var array<int, string> */
	private array $providers = ['google'];

	public function __construct(private DatabaseManager $db)
	{
	}

	public function redirectToProvider(string $provider): RedirectResponse
	{
		$provider = $this->sanitizeProvider($provider);

		return Socialite::driver($provider)->redirect();
	}

	public function handleCallback(string $provider): User
	{
		$provider = $this->sanitizeProvider($provider);

		$driver = Socialite::driver($provider);

		if ($driver instanceof AbstractProvider) {
			$driver->stateless();
		}

		$socialiteUser = $driver->user();

		if (! $socialiteUser instanceof AbstractUser) {
			throw new RuntimeException('Unsupported social provider response type.');
		}

		return $this->db->transaction(function () use ($provider, $socialiteUser) {
			$account = SocialAccount::query()
				->where('provider', $provider)
				->where('provider_id', $socialiteUser->getId())
				->first();

			if ($account) {
				$account->fill($this->accountData($provider, $socialiteUser))->save();

				$this->syncEmailVerification($account->user, $socialiteUser);

				return $account->user;
			}

			$user = $this->findOrCreateUser($socialiteUser);

			$user->socialAccounts()->create($this->accountData($provider, $socialiteUser));

			return $user;
		});
	}

	private function sanitizeProvider(string $provider): string
	{
		$normalized = Str::lower($provider);

		if (! in_array($normalized, $this->providers, true)) {
			throw new InvalidArgumentException("Unsupported social provider [{$provider}].");
		}

		return $normalized;
	}

	private function findOrCreateUser(AbstractUser $socialiteUser): User
	{
		$email = Str::lower($socialiteUser->getEmail() ?? '');

		$user = $email !== ''
			? User::query()->where('email', $email)->first()
			: null;

		if ($user) {
			$this->syncEmailVerification($user, $socialiteUser);

			return $user;
		}

		$name = $socialiteUser->getName()
			?? $socialiteUser->getNickname()
			?? ($email !== '' ? Str::before($email, '@') : 'User '.Str::random(6));

		$user = User::create([
			'name' => $name,
			'email' => $email !== '' ? $email : null,
			'password' => Hash::make(Str::random(40)),
			'role' => 'member',
		]);

		if ($user->wasRecentlyCreated) {
			event(new Registered($user));
		}

		$this->syncEmailVerification($user, $socialiteUser);

		return $user;
	}

	/**
	 * @return (\Illuminate\Support\Carbon|array|mixed|null|string)[]
	 *
	 * @psalm-return array{provider: string, provider_id: string, email: null|string, name: null|string, nickname: null|string, avatar: null|string, token: mixed, refresh_token: mixed, token_expires_at: \Illuminate\Support\Carbon|null, raw: array<string, mixed>}
	 */
	private function accountData(string $provider, AbstractUser $socialiteUser): array
	{
		$expiresInValue = $this->extractProperty($socialiteUser, 'expiresIn');
		$expiresIn = is_numeric($expiresInValue) ? (int) $expiresInValue : null;

		$raw = $this->extractRawPayload($socialiteUser);

		return [
			'provider' => $provider,
			'provider_id' => $socialiteUser->getId(),
			'email' => $socialiteUser->getEmail(),
			'name' => $socialiteUser->getName(),
			'nickname' => $socialiteUser->getNickname(),
			'avatar' => $socialiteUser->getAvatar(),
			'token' => $this->extractProperty($socialiteUser, 'token'),
			'refresh_token' => $this->extractProperty($socialiteUser, 'refreshToken'),
			'token_expires_at' => $expiresIn ? now()->addSeconds((int) $expiresIn) : null,
			'raw' => $raw,
		];
	}

	private function syncEmailVerification(User $user, AbstractUser $socialiteUser): void
	{
		$payload = $this->extractRawPayload($socialiteUser);

		$verified = (bool) (Arr::get($payload, 'email_verified')
			?? Arr::get($payload, 'verified_email'));

		if ($verified && $user->email_verified_at === null) {
			$user->forceFill(['email_verified_at' => now()])->save();
		}
	}

	/**
	 * @return array<string, mixed>
	 */
	private function extractRawPayload(AbstractUser $socialiteUser): array
	{
		if ($socialiteUser instanceof OAuthTwoUser) {
			return $socialiteUser->getRaw();
		}

		return $socialiteUser->user ?? [];
	}

	private function extractProperty(AbstractUser $socialiteUser, string $property): mixed
	{
		return property_exists($socialiteUser, $property) ? $socialiteUser->{$property} : null;
	}
}

