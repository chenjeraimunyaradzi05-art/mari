<?php
/**
 * GlobalHelper
 * Developer: Munyaradzi Chenjerai
 */

/** Check input error */

use App\Models\Candidate;
use App\Models\Company;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

if (! function_exists('vite_asset')) {
    function vite_asset(string $path): string
    {
        $normalized = str_replace('resources/', 'build/', $path);

        return asset($normalized);
    }
}

if(!function_exists('hasError')) {
    function hasError($errors, string $name) : string
    {
        return $errors->has($name) ? 'is-invalid' : '';
    }
}

/** Set sidebar active */
if(!function_exists('setSidebarActive')) {
    function setSidebarActive(array $routes) : string|null
    {
        foreach($routes as $route) {
            if(request()->routeIs($route)) {
                return 'active';
            }
        }
        return null;
    }
}

/** check profile completion */
if(!function_exists('isCompanyProfileComplete')) {
    function isCompanyProfileComplete() : bool
    {
        $requiredFields = ['logo', 'banner', 'bio', 'vision', 'name', 'industry_type_id', 'organization_type_id', 'team_size_id', 'establishment_date', 'phone', 'email', 'country'];
        $companyProfile = Company::where('user_id', Auth::id())->first();

        if (!$companyProfile) {
            return false;
        }

        foreach($requiredFields as $field) {
            if(empty($companyProfile->{$field})) {
                return false;
            }
        }

        return true;
    }
}

/** check candidate profile completion */
if(!function_exists('isCandidateProfileComplete')) {
    function isCandidateProfileComplete() : bool
    {
        $requiredFields = ['experience_id', 'profession_id', 'image', 'full_name', 'birth_date', 'gender', 'bio', 'marital_status', 'country', 'status'];

        $candidateProfile = Candidate::where('user_id', Auth::id())->first();

        if (!$candidateProfile) {
            return false;
        }

        foreach($requiredFields as $field) {
            if(empty($candidateProfile->{$field})) {
                return false;
            }
        }

        return true;
    }
}

/** format date */
if(!function_exists('formatDate')) {
    function formatDate(?string $date) : ?string
    {
        if($date) {
            return date('d M Y',  strtotime($date));
        }

        return null;
    }
}

/** store plan info in session */
if(!function_exists('storePlanInformation')) {
    function storePlanInformation(): void
    {
        session()->forget('user_plan');
        session([
            'user_plan' => isset(Auth::user()?->company?->userPlan) ?
                Auth::user()->company->userPlan : []
        ]);
    }
}

/** format location */
if(!function_exists('formatLocation')) {
    function formatLocation($country = null, $state = null, $city = null, $address = null) : string
    {
        $location = '';
        if($address) {
            $location .= $address;
        }
        if($city) {
            $location .= $address ? ', '.$city : $city;
        }
        if($state) {
            $location .= $city ? ', '.$state : $state;
        }
        if($country) {
            $location .= $state ? ', '.$country : $country;
        }

        return $location;
    }
}

/** format location */
if(!function_exists('calculateEarnings')) {
    /**
     * @psalm-return int<min, max>
     */
    function calculateEarnings($amounts): int
    {

        $total = 0;
        foreach($amounts as $value){
            $amount = intval(preg_replace('/[^0-9]/', '', $value));
            $total += $amount;
        }

        return $total;
    }
}

/** check permission */
if(!function_exists('canAccess')) {
    function canAccess(array $permissions) : bool
    {
        /** @var \App\Models\Admin|null $adminUser */
        $adminUser = Auth::guard('admin')->user();

        if (! $adminUser) {
            return false;
        }

        $permission = $adminUser->hasAnyPermission($permissions);
        $superAdmin = $adminUser->hasRole('Super Admin');

        if($permission || $superAdmin) {
            return true;
        }

        return false;

    }
}

/**
 * Get the authenticated user with proper type hints.
 * @return \App\Models\User|null
 */
if(!function_exists('currentUser')) {
    function currentUser(): ?\App\Models\User
    {
        return Auth::user();
    }
}

/**
 * Get the authenticated user's ID.
 * @return int|null
 */
if(!function_exists('currentUserId')) {
    function currentUserId(): int|string|null
    {
        return Auth::id();
    }
}

/**
 * Flash success message to session
 */
if(!function_exists('flashSuccess')) {
    function flashSuccess($message, $title = 'Success'): \Illuminate\Session\SessionManager
    {
        session()->flash('success', $message);
        return session();
    }
}

/**
 * Flash error message to session
 */
if(!function_exists('flashError')) {
    function flashError($message, $title = 'Error'): \Illuminate\Session\SessionManager
    {
        session()->flash('error', $message);
        return session();
    }
}

/**
 * Notify helper for toast notifications
 */
if(!function_exists('notify')) {
    function notify(): object
    {
        return new class {
            public function success($message, $title = 'Success'): void {
                session()->flash('notify.success', $message);
            }

            public function error($message, $title = 'Error'): void {
                session()->flash('notify.error', $message);
            }

            public function info($message, $title = 'Info'): void {
                session()->flash('notify.info', $message);
            }

            public function warning($message, $title = 'Warning'): void {
                session()->flash('notify.warning', $message);
            }
        };
    }
}

if (! function_exists('member_label')) {
    function member_label(string $key = 'member', ?string $fallback = null): array|string|null
    {
        $translationKey = "member.$key";
        $translated = __($translationKey);

        if ($translated !== $translationKey) {
            return $translated;
        }

        $configValue = config("experience.labels.$key");
        if (is_string($configValue) && trim($configValue) !== '') {
            return $configValue;
        }

        if ($fallback !== null) {
            return $fallback;
        }

        return (string) Str::of($key)->replace('_', ' ')->title();
    }
}

if (! function_exists('getSessionLanguage')) {
    function getSessionLanguage(): string
    {
        $sessionLanguage = session('lang_code');
        if (is_string($sessionLanguage) && $sessionLanguage !== '') {
            return $sessionLanguage;
        }

        $userLanguage = optional(Auth::user())->language ?? optional(Auth::user())->preferred_locale;
        if (is_string($userLanguage) && $userLanguage !== '') {
            return $userLanguage;
        }

        return (string) config('app.locale', 'en');
    }
}

if (! function_exists('money_format')) {
    function money_format($amount, string $currency = 'AUD', int $decimals = 0): string
    {
        if ($amount === null || $amount === '') {
            $amount = 0;
        }

        if (! is_numeric($amount)) {
            $normalized = preg_replace('/[^\d.\-]/', '', (string) $amount);
            $amount = $normalized === '' ? 0 : (float) $normalized;
        }

        $decimals = max(0, $decimals);
        $value = number_format((float) $amount, $decimals, '.', ',');

        $currencyCode = strtoupper($currency);
        $symbols = [
            'AUD' => 'A$',
            'USD' => '$',
            'EUR' => '€',
            'GBP' => '£',
        ];

        $defaultSymbol = config('app.currency_symbol', $symbols['AUD']);
        $symbol = $symbols[$currencyCode] ?? ($currencyCode ? $currencyCode.' ' : $defaultSymbol);

        return $symbol.$value;
    }
}

