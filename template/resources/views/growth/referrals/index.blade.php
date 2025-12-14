@extends('frontend.layouts.master')

@section('content')
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">
                    <h4 class="mb-0">Invite Friends & Earn Rewards</h4>
                </div>
                <div class="card-body">
                    @if (session('success'))
                        <div class="alert alert-success">
                            {{ session('success') }}
                        </div>
                    @endif

                    @if (session('error'))
                        <div class="alert alert-danger">
                            {{ session('error') }}
                        </div>
                    @endif

                    <div class="text-center mb-4">
                        <h5>Your Referral Code</h5>
                        <div class="display-4 text-primary font-weight-bold p-3 bg-light rounded">
                            {{ $referralCode }}
                        </div>
                        <p class="text-muted mt-2">Share this code with your friends!</p>
                    </div>

                    <hr>

                    <form action="{{ route('referrals.send') }}" method="POST" class="mb-4">
                        @csrf
                        <div class="form-group">
                            <label for="email">Invite by Email</label>
                            <div class="input-group">
                                <input type="email" name="email" id="email" class="form-control" placeholder="friend@example.com" required>
                                <div class="input-group-append">
                                    <button type="submit" class="btn btn-primary">Send Invitation</button>
                                </div>
                            </div>
                        </div>
                    </form>

                    <div class="row text-center">
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3>{{ $referralCount }}</h3>
                                    <small>Total Referrals</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3>{{ $completedReferrals }}</h3>
                                    <small>Completed</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <h3>{{ $earnedRewards }}</h3>
                                    <small>Points Earned</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4">
                        <h5>Your Referrals</h5>
                        <ul class="list-group">
                            @forelse ($referrals as $referral)
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    {{ $referral->referred_email }}
                                    <span class="badge badge-{{ $referral->status === 'completed' ? 'success' : 'secondary' }}">
                                        {{ ucfirst($referral->status) }}
                                    </span>
                                </li>
                            @empty
                                <li class="list-group-item text-center text-muted">No referrals yet. Start inviting!</li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
