@extends('admin.layouts.app')

@section('content')
    <div class="section-header">
        <h1>Create Widget</h1>
    </div>

    <div class="section-body">
        <form method="POST" action="{{ route('admin.widgets.store') }}">
            @csrf

            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" name="name" id="name" class="form-control" value="{{ old('name') }}" required>
            </div>

            <div class="form-group">
                <label for="slug">Slug (optional)</label>
                <input type="text" name="slug" id="slug" class="form-control" value="{{ old('slug') }}">
            </div>

            <button class="btn btn-primary">Create</button>
        </form>
    </div>
@endsection
