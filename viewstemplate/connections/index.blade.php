@extends('frontend.layouts.master')
@section('contents')

<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">My Connections</h2>

        <!-- AI-Powered Connection Suggestions -->
        <div class="mb-40">
            <h4 class="mb-3" style="color: #8B5CF6;">AI-Powered Connection Suggestions</h4>
            <div class="row">
                @if(isset($aiConnectionSuggestions) && count($aiConnectionSuggestions) > 0)
                    @foreach($aiConnectionSuggestions as $suggestion)
                        <div class="col-md-4 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h5>{{ $suggestion['name'] }}</h5>
                                    <p>{{ $suggestion['reason'] }}</p>
                                    <form method="POST" action="{{ route('connections.store') }}">
                                        @csrf
                                        <input type="hidden" name="connected_user_id" value="{{ $suggestion['id'] }}">
                                        <input type="hidden" name="type" value="ai_suggested">
                                        <button type="submit" class="btn btn-primary">Connect</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    @endforeach
                @else
                    <div class="col-12">
                        <p class="text-muted">No AI connection suggestions available. Update your profile or engage more for better recommendations!</p>
                    </div>
                @endif
            </div>
        </div>

        <div class="row">
            @foreach ($connections as $connection)
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5>Connected to: {{ $connection->connected_user_id }}</h5>
                            <p>Status: <span class="badge bg-info">{{ $connection->status }}</span></p>
                            <form method="POST" action="{{ route('connections.update', $connection->id) }}">
                                @csrf
                                @method('PUT')
                                <select name="status" class="form-control mb-2" style="color:#d50060;font-weight:bold;">
                                    <option value="accepted">Accept</option>
                                    <option value="rejected">Reject</option>
                                </select>
                                <button type="submit" class="btn btn-primary">Update</button>
                            </form>
                            <form method="POST" action="{{ route('connections.destroy', $connection->id) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger mt-2">Remove</button>
                            </form>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </div>
</section>
@endsection

