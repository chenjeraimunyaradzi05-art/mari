<?php

namespace App\Support;

use App\Models\Job;
use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

final class EmployerAccessGate
{
    public static function resolveCompanyId(?User $user = null): int
    {
        $user = $user ?? Auth::user();

        abort_if(! $user instanceof Authenticatable, Response::HTTP_FORBIDDEN, 'Sign in as an employer to continue.');

        if ($user->participant_profile_type === 'guardian_hold') {
            abort(Response::HTTP_FORBIDDEN, 'Your account is under guardian review. Guardian approval is required to continue.');
        }

        $companyId = $user->company?->getKey();

        abort_if(! $companyId, Response::HTTP_FORBIDDEN, 'Complete your company profile to access employer tooling.');

        return (int) $companyId;
    }

    public static function ensureJobAccess(int|Job $job, ?User $user = null): Job
    {
        $companyId = self::resolveCompanyId($user);
        $jobModel = $job instanceof Job ? $job : Job::query()->findOrFail($job);

        abort_if((int) $jobModel->company_id !== $companyId, Response::HTTP_FORBIDDEN, 'Rivalry protections prevented access to this job.');

        return $jobModel;
    }

    public static function ensureOrderAccess(Order $order, ?User $user = null): void
    {
        $companyId = self::resolveCompanyId($user);

        abort_if((int) $order->company_id !== $companyId, Response::HTTP_FORBIDDEN, 'Rivalry protections prevented access to this billing record.');
    }
}

