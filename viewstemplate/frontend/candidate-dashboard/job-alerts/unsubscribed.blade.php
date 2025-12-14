<x-app-layout>
    <section class="container py-12">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="card border-0 shadow-lg text-center p-5">
                    <div class="mb-4">
                        <span class="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center" style="width: 96px; height: 96px;">
                            <i class="fas fa-bell-slash fa-2x"></i>
                        </span>
                    </div>
                    <h1 class="h3 mb-3">Alert paused</h1>
                    <p class="text-muted mb-4">You've unsubscribed from <strong>{{ $jobAlert->name ?? 'this alert' }}</strong>. Future emails for this alert will stop immediately, but you can re-activate it any time from your dashboard.</p>
                    <div class="d-flex justify-content-center gap-3 flex-wrap">
                        <a href="{{ route('member.job-alerts.index') }}" class="btn btn-primary">
                            <i class="fas fa-bell me-2"></i>Manage alerts
                        </a>
                        <a href="{{ route('member.dashboard') }}" class="btn btn-outline-secondary">Back to dashboard</a>
                    </div>
                    <p class="text-muted small mt-4 mb-0">Need help? Reply to the email that brought you here and we'll jump in.</p>
                </div>
            </div>
        </div>
    </section>
</x-app-layout>
