@extends('women.real-estate.layouts.console')

@section('console-content')
    <div class="wr-console-hero text-center sm:text-left">
        <span class="wr-console-pill self-center sm:self-start">WomenRise Owner Console</span>
        <h1 class="wr-console-headline">Verification Needed</h1>
        <p class="wr-console-subtitle">
            Please verify your email address to unlock the women-first listing studio. Verification keeps our housing community trusted and safe.
        </p>
    </div>

    <div class="wr-console-shell">
        <div class="wr-console-card-shell">
            <div class="wr-console-card flex flex-col items-center gap-6 text-center">
                <div class="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-10 w-10">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <div class="space-y-3">
                    <h2 class="text-xl font-semibold text-slate-900">Verify your WomenRise identity</h2>
                    <p class="text-sm text-slate-600">
                        We’ve sent a verification link to your email. Complete that step to continue launching and managing women-focused listings.
                    </p>
                </div>

                <div class="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                    <a href="{{ route('verification.notice') }}" class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.26em] text-white shadow-md transition hover:bg-indigo-500">
                        Resend verification email
                    </a>
                    <a href="{{ route('women.real-estate.listings.index') }}" class="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.26em] text-indigo-700 transition hover:bg-indigo-50">
                        Back to listings
                    </a>
                </div>
            </div>
        </div>
    </div>
@endsection
