@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Organization Pages</h1>
        </div>

        <div class="section-body">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>All Pages</h4>
                                                {{-- header-level delete button removed; per-row delete exists below --}}
                            <form action="{{ route('admin.organization-pages.index') }}" method="GET">
                                <div class="input-group">
                                    <input type="text" class="form-control" placeholder="Search" name="search" value="{{ request('search') }}">
                                    <div class="input-group-btn">
                                        <button type="submit" class="btn btn-primary" style="height: 40px;"><i class="fas fa-search"></i></button>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <button type="button"  href="{{ route('admin.organization-pages.create') }}" class="btn btn-primary">
                            <i class="fas fa-plus-circle"></i> Create new
                        </button>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Company</th>
                                        <th>Followers</th>
                                        <th>Updated</th>
                                        <th style="width: 12%">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse($pages as $page)
                                        <tr>
                                            <td>{{ $page->name }}</td>
                                            <td>{{ $page->type?->label() ?? '—' }}</td>
                                            <td>
                                                <span class="badge badge-{{ $page->profile_status === 'published' ? 'success' : ($page->profile_status === 'archived' ? 'danger' : 'secondary') }}">
                                                    {{ ucfirst($page->profile_status) }}
                                                </span>
                                            </td>
                                            <td>{{ $page->company?->name ?? '—' }}</td>
                                            <td>{{ $page->followers_count }}</td>
                                            <td>{{ $page->updated_at->diffForHumans() }}</td>
                                            <td>
                                                <a href="{{ route('organizations.show', $page->slug) }}" class="btn btn-sm btn-info" target="_blank" rel="noopener">
                                                    <i class="fas fa-external-link-alt"></i>
                                                </a>
                                                <a href="{{ route('admin.organization-pages.edit', $page->id) }}" class="btn btn-sm btn-primary">
                                                    <i class="fas fa-edit"></i>
                                                </a>
                                                <form method="POST" action="{{ route('admin.organization-pages.destroy', $page->id) }}" class="d-inline">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button type="submit" class="btn btn-sm btn-danger delete-item">
                                                        <i class="fas fa-trash-alt"></i>
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="7" class="text-center py-4">No organization pages found.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        <nav class="d-inline-block">
                            @if (is_object($pages) && method_exists($pages, 'hasPages') && $pages->hasPages())
                                {{ $pages->withQueryString()->links() }}
                            @endif
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection

