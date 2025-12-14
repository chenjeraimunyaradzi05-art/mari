@extends('admin.layouts.master')

@php
    use Illuminate\Support\Str;
@endphp

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Verification Alerts Inbox</h1>
            <div class="section-header-button">
                <button type="button"  href="{{ route('admin.social-verifications.index') }}" class="btn btn-outline-primary">
                    <i class="fas fa-shield-alt"></i>
                    Open reviewer queue
                </button>
            </div>
        </div>

        <div class="section-body">
            <div class="card">
                <div class="card-header">
                    <h4>Recent notifications</h4>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-striped mb-0">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Created</th>
                                    <th>Status</th>
                                    <th class="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($notifications as $notification)
                                    @php
                                        $data = $notification->data ?? [];
                                    @endphp
                                    <tr>
                                        <td>{{ $data['title'] ?? Str::headline($notification->type) }}</td>
                                        <td>
                                            {{ $data['message'] ?? ($data['profile']['display_name'] ?? '—') }}
                                            @if(isset($data['profile']['username']))
                                                <div class="text-muted small">@ {{ $data['profile']['username'] }}</div>
                                            @endif
                                        </td>
                                        <td>{{ $notification->created_at?->diffForHumans() ?? '—' }}</td>
                                        <td>
                                            @if($notification->read_at)
                                                <span class="badge badge-success">Read</span>
                                            @else
                                                <span class="badge badge-warning">Unread</span>
                                            @endif
                                        </td>
                                        <td class="text-end">
                                            <div class="btn-group" role="group">
                                                @if(!$notification->read_at)
                                                    <form action="{{ route('admin.notifications.read', $notification) }}" method="POST" class="me-2">
                                                        @csrf
                                                        <button class="btn btn-sm btn-success" type="submit">
                                                            <i class="fas fa-check"></i> Mark read
                                                        </button>
                                                    </form>
                                                @endif
                                                @if(!empty($data['action_url']))
                                                    <button type="button"  href="{{ $data['action_url'] }}" class="btn btn-sm btn-primary" target="_blank">
                                                        <i class="fas fa-external-link-alt"></i> Open
                                                    </button>
                                                @endif
                                                <form action="{{ route('admin.notifications.destroy', $notification) }}" method="POST" class="ms-2">
                                                    @csrf
                                                    @method('DELETE')
                                                    <button class="btn btn-sm btn-danger" type="submit">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="5" class="text-center py-5">No verification alerts yet.</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                @if (is_object($notifications) && method_exists($notifications, 'hasPages') && $notifications->hasPages())
                    <div class="card-footer text-right">
                        {{ $notifications->withQueryString()->links() }}
                    </div>
                @endif
            </div>
        </div>
    </section>
@endsection

