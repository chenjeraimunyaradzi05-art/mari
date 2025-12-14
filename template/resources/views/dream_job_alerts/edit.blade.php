@extends('layouts.app')

@section('content')
    <h1>Edit Dream Job Alert</h1>

    <p><a href="{{ route('dream_job_alerts.ui.index') }}">Back to alerts</a></p>

    @php
        $action = route('dream_job_alerts.ui.update', $alert);
        $method = 'PATCH';
    @endphp

    @include('dream_job_alerts._form', ['alert' => $alert, 'action' => $action, 'method' => $method])
@endsection
