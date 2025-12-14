@extends('admin.layouts.app')

@section('content')
    <div class="section-header">
        <h1>Admin Widgets</h1>
    </div>

    <div class="section-body">
        <a href="{{ route('admin.widgets.create') }}" class="btn btn-primary mb-3">Create widget</a>

        <div class="card">
            <div class="card-body">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($widgets as $widget)
                            <tr>
                                <td>{{ $widget->id }}</td>
                                <td>{{ $widget->name }}</td>
                                <td>{{ $widget->slug }}</td>
                                <td>{{ $widget->created_at->toDateString() }}</td>
                                <td>
                                    <a href="{{ route('admin.widgets.show', $widget) }}" class="btn btn-sm btn-outline-primary">View</a>
                                    <a href="{{ route('admin.widgets.edit', $widget) }}" class="btn btn-sm btn-primary">Edit</a>
                                    <form action="{{ route('admin.widgets.destroy', $widget) }}" method="POST" class="d-inline">
                                        @csrf
                                        @method('DELETE')
                                        <button class="btn btn-sm btn-danger" onclick="return confirm('Delete widget?')">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5">No widgets yet.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>

                {{ $widgets->links() }}
            </div>
        </div>
    </div>
@endsection
