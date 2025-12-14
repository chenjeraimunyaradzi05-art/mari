@extends('admin.layouts.app')

@section('content')
    <div class="section-header">
        <h1>Edit Widget</h1>
    </div>

    <div class="section-body">
        <form method="POST" action="{{ route('admin.widgets.update', $widget) }}">
            @csrf
            @method('PUT')

            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" name="name" id="name" class="form-control" value="{{ old('name', $widget->name) }}" required>
            </div>

            <div class="form-group">
                <label for="slug">Slug</label>
                <input type="text" name="slug" id="slug" class="form-control" value="{{ old('slug', $widget->slug) }}" required>
            </div>

            <button class="btn btn-primary">Update</button>
        </form>
    </div>
@endsection
