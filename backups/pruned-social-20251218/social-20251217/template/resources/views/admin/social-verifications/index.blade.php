@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Social Profile Verifications</h1>
        </div>

        <div class="section-body">
            <div class="card">
                <div class="card-header flex-column flex-md-row align-items-md-center">
                    <h4 class="mb-0">Incoming requests</h4>
                    <div class="card-header-form ms-md-auto w-100 w-md-auto mt-3 mt-md-0">
                        <form action="{{ route('admin.social-verifications.index') }}" method="GET" class="form-inline">
                            <div class="form-group mr-2 mb-2">
                                <select name="status" class="form-control">
                                    <option value="">All statuses</option>
                                    @foreach($statuses as $statusOption)
                                        <option value="{{ $statusOption->value }}" @selected(($filters['status'] ?? null) === $statusOption->value)>
                                            {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $statusOption->value)) }}
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="input-group mb-2">
                                <input type="text" class="form-control" name="q" placeholder="Search profile or email" value="{{ $filters['q'] ?? '' }}">
                                <div class="input-group-append">
                                    <button class="btn btn-primary" type="submit"><i class="fas fa-search"></i></button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Profile</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th>Reviewer</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($verifications as $verification)
                                    <tr>
                                        <td>#{{ $verification->id }}</td>
                                        <td>
                                            <strong>{{ $verification->profile?->display_name ?? 'Unknown' }}</strong>
                                            <br>
                                            <small>@ {{ $verification->profile?->username }}</small>
                                        </td>
                                        <td>
                                            <span class="badge badge-info">
                                                {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $verification->status->value)) }}
                                            </span>
                                        </td>
                                        <td>{{ optional($verification->submitted_at)->format('M d, Y H:i') ?? '—' }}</td>
                                        <td>{{ $verification->reviewer?->name ?? '—' }}</td>
                                        <td>
                                            <button type="button"  href="{{ route('admin.social-verifications.show', $verification) }}" class="btn btn-sm btn-outline-primary">Review</button>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="6" class="text-center py-5">No verification requests yet.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                    @if (is_object($verifications) && method_exists($verifications, 'hasPages') && $verifications->hasPages())
                        <div class="card-footer text-right">
                            {{ $verifications->withQueryString()->links() }}
                        </div>
                    @endif
            </div>
        </div>
    </section>
@endsection

