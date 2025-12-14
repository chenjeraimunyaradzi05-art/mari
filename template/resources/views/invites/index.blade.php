@extends('frontend.layouts.master')
@section('contents')

<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">My Invites</h2>
        <div class="row">
            @foreach ($invites as $invite)
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5>To: {{ $invite->recipient_email ?? $invite->recipient_phone }}</h5>
                            <p>{{ $invite->message }}</p>
                            <span class="badge bg-info">{{ $invite->status }}</span>
                            <form method="POST" action="{{ route('invites.destroy', $invite->id) }}">
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

