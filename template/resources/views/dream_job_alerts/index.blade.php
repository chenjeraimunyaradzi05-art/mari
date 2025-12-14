@extends('layouts.app')

@section('content')
    <h1>My Dream Job Alerts</h1>

    @if(session('success'))
        <div style="color:green">{{ session('success') }}</div>
    @endif

    <p><a href="{{ route('dream_job_alerts.ui.create') }}">Create new alert</a></p>

    @if($alerts->isEmpty())
        <p>No alerts yet.</p>
    @else
        <table>
            <thead><tr><th>Title</th><th>Industry</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
                @foreach($alerts as $alert)
                    <tr>
                        <td>{{ $alert->job_title }}</td>
                        <td>{{ $alert->industry }}</td>
                        <td>{{ $alert->location }}</td>
                        <td>
                            <a href="{{ route('dream_job_alerts.ui.edit', $alert) }}">Edit</a>
                            <form method="POST" action="{{ route('dream_job_alerts.ui.destroy', $alert) }}" style="display:inline">
                                @csrf
                                @method('DELETE')
                                <button type="submit">Delete</button>
                            </form>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
@endsection
