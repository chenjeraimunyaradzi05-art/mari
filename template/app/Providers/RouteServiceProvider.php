<?php
/**
 * RouteServiceProvider
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Providers;

use App\Models\SocialComment;
use App\Models\SocialMessage;
use App\Models\SocialMessageRequest;
use App\Models\SocialPost;
use App\Models\SocialThread;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

final class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/dashboard';
    public const MEMBER_DASHBOARD = '/member/dashboard';
    public const CANDIDATE_DASHBOARD = '/member/dashboard';
    public const COMPANY_DASHBOARD = '/company/dashboard';
    public const REAL_ESTATE_DASHBOARD = '/real-estate';
    public const ADMIN_DASHBOARD = '/admin/dashboard';
    public const TAFE_UNIVERSITY_DASHBOARD = '/education/tafe-university';
    public const PUBLIC_SECTOR_DASHBOARD = '/public-sector';
    public const BUSINESS_DASHBOARD = '/business/dashboard';



    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    #[\Override]
    public function boot(): void
    {
        Route::model('post', SocialPost::class);
        Route::model('comment', SocialComment::class);
        Route::model('conversation', SocialThread::class);
        Route::model('messageRequest', SocialMessageRequest::class);
        Route::model('message', SocialMessage::class);

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('lead-submissions', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('ai-concierge', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();

            return [
                Limit::perMinute(20)
                    ->by('ai-minute:' . $key)
                    ->response(static function () {
                        return response()->json([
                            'message' => 'Athena is pausing for a moment. Please try again shortly.',
                        ], 429);
                    }),
                Limit::perHour(200)->by('ai-hour:' . $key),
            ];
        });

        RateLimiter::for('women-mortgage-quotes', function (Request $request) {
            $userKey = $request->user()?->id ?? $request->ip();
            $listingKey = optional($request->route('listing'))->getKey() ?? 'global';
            $compositeKey = $userKey . '|' . $listingKey;

            return Limit::perMinute(30)
                ->by($compositeKey)
                ->response(static function () {
                    return response()->json([
                        'message' => 'Mortgage scenario requests are temporarily limited. Try again soon.',
                    ], 429);
                });
        });

        RateLimiter::for('social-ai', function (Request $request) {
            $limit = (int) config('social.ai_assist.rate_limit', 45);
            $limit = max(1, $limit);
            $key = $request->user()?->id ?? $request->ip();

            return Limit::perMinute($limit)
                ->by($key)
                ->response(static function () {
                    return response()->json([
                        'message' => 'Hold tight—AI suggestions are cooling down. Try again in a moment.',
                    ], 429);
                });
        });

        RateLimiter::for('persona-switch', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();

            return Limit::perHour(40)->by($key);
        });

        $messagingLimits = config('social_messaging.rate_limits');

        RateLimiter::for('social-messaging-send', function (Request $request) use ($messagingLimits) {
            $profileKey = $request->input('social_profile_id')
                ?? optional($request->user()?->socialProfile)->getKey()
                ?? $request->user()?->id
                ?? $request->ip();

            return [
                Limit::perMinute($messagingLimits['send_per_minute'])
                    ->by('dm-minute:'.$profileKey)
                    ->response(static function () {
                        return response()->json([
                            'message' => 'You are messaging quickly—wait a moment before sending again.',
                        ], 429);
                    }),
                Limit::perHour($messagingLimits['send_per_hour'])
                    ->by('dm-hour:'.$profileKey),
                Limit::perDay($messagingLimits['send_per_day'])
                    ->by('dm-day:'.$profileKey),
            ];
        });

        RateLimiter::for('social-messaging-attachments', function (Request $request) use ($messagingLimits) {
            $profileKey = $request->input('social_profile_id')
                ?? optional($request->user()?->socialProfile)->getKey()
                ?? $request->user()?->id
                ?? $request->ip();

            return Limit::perDay($messagingLimits['attachments_per_day'])
                ->by('dm-attachments:'.$profileKey)
                ->response(static function () {
                    return response()->json([
                        'message' => 'Attachment limit reached for today. Remove a file or try again tomorrow.',
                    ], 429);
                });
        });

        RateLimiter::for('social-messaging-requests', function (Request $request) use ($messagingLimits) {
            $profileKey = $request->input('social_profile_id')
                ?? optional($request->user()?->socialProfile)->getKey()
                ?? $request->user()?->id
                ?? $request->ip();

            return Limit::perDay($messagingLimits['requests_per_day'])
                ->by('dm-requests:'.$profileKey);
        });

        RateLimiter::for('social-messaging-request-accepts', function (Request $request) use ($messagingLimits) {
            $profileKey = $request->input('social_profile_id')
                ?? optional($request->user()?->socialProfile)->getKey()
                ?? $request->user()?->id
                ?? $request->ip();

            return Limit::perHour($messagingLimits['request_accepts_per_hour'])
                ->by('dm-accepts:'.$profileKey);
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
            Route::middleware('web')
            ->group(base_path('routes/admin.php'));
        });
    }
}

