@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Organization Type</h1>
        </div>

        <div class="section-body">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h4>All Organization Types</h4>
                        <div class="card-header-form">
                            <form action="{{ route('admin.organization-types.index') }}" method="GET">
                                <div class="input-group">
                                    <input type="text" class="form-control" placeholder="Search" name="search" value="{{ request('search') }}">
                                    <div class="input-group-btn">
                                        <button type="submit" style="height: 40px;" class="btn btn-primary"><i class="fas fa-search"></i></button>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <a href="{{ route('admin.organization-types.create') }}" class="btn btn-primary"> <i class="fas fa-plus-circle"></i> Create new</a>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <tr>
                                    <th>Name</th>
                                    <th>slug</th>
                                    <th style="width: 10%">Action</th>
                                </tr>
                            <tbody>
                                @forelse ($organizationTypes as $type)
                                <tr>
                                    <td>{{ $type->name }}</td>
                                    <td>{{ $type->slug }}</td>
                                    <td>
                                        <a href="{{ route('admin.organization-types.edit', $type->id) }}" class="btn-sm btn btn-primary"><i class="fas fa-edit"></i></a>
                                        <form method="POST" action="{{ route('admin.organization-types.destroy', $type->id) }}" class="d-inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="btn-sm btn btn-danger delete-item"><i class="fas fa-trash-alt"></i></button>
                                        </form>
                                    </td>
                                </tr>
                                @empty
                                    <tr>
                                        <td colspan="3" class="text-center">No result found!</td>
                                    </tr>
                                @endforelse

                            </tbody>

                            </table>
                        </div>
                    </div>
                    <div class="card-footer text-right">
                        <nav class="d-inline-block">
                            @if (is_object($organizationTypes) && method_exists($organizationTypes, 'hasPages') && $organizationTypes->hasPages())
                                {{ $organizationTypes->withQueryString()->links() }}
                            @endif
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    </section>

@endsection
