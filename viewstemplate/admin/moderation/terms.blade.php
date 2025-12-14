@extends('admin.layouts.master')

@section('contents')
<div class="container-fluid">
    <div class="page-header d-flex justify-content-between align-items-center">
        <div>
            <h3 class="page-title mb-0">Sensitive Terms</h3>
            <p class="text-muted mb-0">Deterministic filters that complement AI moderation.</p>
        </div>
        <a href="{{ route('admin.moderation.dashboard') }}" class="btn btn-outline-secondary">Back to dashboard</a>
    </div>

    <div class="row">
        <div class="col-lg-4">
            <div class="card">
                <div class="card-header">Add term</div>
                <div class="card-body">
                    <form method="post" action="{{ route('admin.moderation.terms.store') }}">
                        @csrf
                        <div class="mb-3">
                            <label class="form-label">Term</label>
                            <input type="text" name="term" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Severity</label>
                            <select name="severity" class="form-select" required>
                                @foreach(array_keys(config('moderation.severity_actions')) as $severity)
                                    <option value="{{ $severity }}">{{ ucfirst($severity) }}</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Replacement (optional)</label>
                            <input type="text" name="replacement" class="form-control">
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" name="is_active" value="1" checked>
                            <label class="form-check-label">Active</label>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Save</button>
                    </form>
                </div>
            </div>
        </div>
        <div class="col-lg-8">
            <div class="card">
                <div class="card-header">Dictionary</div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table align-middle">
                            <thead>
                                <tr>
                                    <th>Term</th>
                                    <th>Severity</th>
                                    <th>Active</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($terms as $term)
                                    <tr>
                                        <td>{{ $term->term }}</td>
                                        <td>{{ ucfirst($term->severity) }}</td>
                                        <td>
                                            <span class="badge {{ $term->is_active ? 'bg-success' : 'bg-secondary' }}">
                                                {{ $term->is_active ? 'Yes' : 'No' }}
                                            </span>
                                        </td>
                                        <td class="text-end">
                                            <form method="post" action="{{ route('admin.moderation.terms.destroy', $term) }}" onsubmit="return confirm('Remove this term?')">
                                                @csrf
                                                @method('delete')
                                                <button class="btn btn-sm btn-outline-danger">Delete</button>
                                            </form>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="text-center text-muted">No terms defined.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                    <div class="d-flex justify-content-end">
                        {{ $terms->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
