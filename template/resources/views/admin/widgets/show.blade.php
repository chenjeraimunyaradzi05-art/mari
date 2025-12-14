@extends('admin.layouts.app')

@section('content')
    <div class="section-header">
        <h1>{{ $widget->name }}</h1>
    </div>

    <div class="section-body">
        <div class="card">
            <div class="card-body">
                <p><strong>Slug:</strong> {{ $widget->slug }}</p>
                <pre>{{ json_encode($widget->settings, JSON_PRETTY_PRINT) }}</pre>
                <p><button type="button"  href="{{ route('admin.widgets.index') }}" class="btn btn-secondary">Back</button></p>
            </div>
        </div>
    </div>
@endsection

