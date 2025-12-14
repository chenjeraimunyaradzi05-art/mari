@extends('frontend.layouts.master')
@section('contents')

<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">Notifications</h2>

        <!-- AI-Powered Notification Suggestions & Real-Time Alerts -->
        <div class="mb-40">
            <h4 class="mb-3" style="color: #8B5CF6;">AI-Powered Alerts & Suggestions</h4>
            <div class="row">
                @if(isset($aiNotifications) && count($aiNotifications) > 0)
                    @foreach($aiNotifications as $alert)
                        <div class="col-md-6 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <p style="color:#E91E8C;font-weight:bold;">{{ $alert['title'] }}</p>
                                    <p>{{ $alert['message'] }}</p>
                                    <span class="badge bg-info">AI Alert</span>
                                    @if(isset($alert['action']) && $alert['action'])
                                        <form method="POST" action="{{ $alert['action']['url'] }}">
                                            @csrf
                                            <button type="submit" class="btn btn-primary mt-2">{{ $alert['action']['label'] }}</button>
                                        </form>
                                    @endif
                                </div>
                            </div>
                        </div>
                    @endforeach
                @else
                    <div class="col-12">
                        <p class="text-muted">No AI alerts at this time. Engage more for smart notifications!</p>
                    </div>
                @endif
            </div>
        </div>

        <div class="row">
            @foreach ($notifications as $notification)
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <p>{{ $notification->type }}</p>
                            <pre>{{ json_encode($notification->data, JSON_PRETTY_PRINT) }}</pre>
                            <span class="badge bg-info">{{ $notification->read_at ? 'Read' : 'Unread' }}</span>
                            <form method="POST" action="{{ route('notifications.markRead', $notification->id) }}">
                                @csrf
                                <button type="submit" class="btn btn-success mt-2">Mark as Read</button>
                            </form>
                            <form method="POST" action="{{ route('notifications.destroy', $notification->id) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger mt-2">Delete</button>
                            </form>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>
</section>
@endsection

