@extends('admin.layouts.app')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0 text-gray-800">Review Identity Flag #{{ $identityFlag->id }}</h1>
        <button type="button"  href="{{ route('admin.identity-flags.index') }}" class="btn btn-secondary">Back to List</button>
    </div>

    <div class="row">
        <div class="col-md-8">
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 font-weight-bold text-primary">Flag Details</h6>
                </div>
                <div class="card-body">
                    <dl class="row">
                        <dt class="col-sm-3">User</dt>
                        <dd class="col-sm-9">{{ $identityFlag->user->name }} ({{ $identityFlag->user->email }})</dd>

                        <dt class="col-sm-3">Reason</dt>
                        <dd class="col-sm-9">{{ $identityFlag->reason }}</dd>

                        <dt class="col-sm-3">Score</dt>
                        <dd class="col-sm-9">{{ $identityFlag->score }}</dd>

                        <dt class="col-sm-3">Signals</dt>
                        <dd class="col-sm-9">
                            <pre class="bg-light p-3 rounded">{{ json_encode($identityFlag->signals, JSON_PRETTY_PRINT) }}</pre>
                        </dd>

                        <dt class="col-sm-3">Metadata</dt>
                        <dd class="col-sm-9">
                            <pre class="bg-light p-3 rounded">{{ json_encode($identityFlag->metadata, JSON_PRETTY_PRINT) }}</pre>
                        </dd>
                    </dl>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card shadow mb-4">
                <div class="card-header py-3">
                    <h6 class="m-0 font-weight-bold text-primary">Resolution</h6>
                </div>
                <div class="card-body">
                    <form action="{{ route('admin.identity-flags.update', $identityFlag) }}" method="POST">
                        @csrf
                        @method('PUT')

                        <div class="form-group">
                            <label for="status">Status</label>
                            <select name="status" id="status" class="form-control">
                                <option value="pending" {{ $identityFlag->status->value === 'pending' ? 'selected' : '' }}>Pending</option>
                                <option value="resolved" {{ $identityFlag->status->value === 'resolved' ? 'selected' : '' }}>Resolved (Allowed)</option>
                                <option value="dismissed" {{ $identityFlag->status->value === 'dismissed' ? 'selected' : '' }}>Dismissed (False Positive)</option>
                                <option value="banned" {{ $identityFlag->status->value === 'banned' ? 'selected' : '' }}>Banned</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="resolution_notes">Notes</label>
                            <textarea name="resolution_notes" id="resolution_notes" rows="4" class="form-control">{{ $identityFlag->resolution_notes }}</textarea>
                        </div>

                        <button type="submit" class="btn btn-primary btn-block">Update Flag</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

