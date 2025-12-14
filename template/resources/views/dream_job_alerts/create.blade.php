@extends('layouts.app')

@section('content')
    <h1>Create Dream Job Alert</h1>

    <p><a href="{{ route('dream_job_alerts.ui.index') }}">Back to alerts</a></p>

    @php
        $action = route('dream_job_alerts.ui.store');
        $method = 'POST';
    @endphp

    @include('dream_job_alerts._form', ['alert' => $alert, 'action' => $action, 'method' => $method])
@endsection
