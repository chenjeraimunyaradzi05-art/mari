@extends('frontend.layouts.master')
@section('contents')

<section class="section-box mt-75">
    <div class="container">
        <h2 class="mb-20" style="color:#d50060;font-weight:bold;">Groups & Communities</h2>

        <!-- AI-Powered Group Suggestions -->
        <div class="mb-40">
            <h4 class="mb-3" style="color: #8B5CF6;">AI-Powered Group Suggestions</h4>
            <div class="row">
                @if(isset($aiGroupSuggestions) && count($aiGroupSuggestions) > 0)
                    @foreach($aiGroupSuggestions as $suggestion)
                        <div class="col-md-4 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h5>{{ $suggestion['name'] }}</h5>
                                    <p>{{ $suggestion['reason'] }}</p>
                                    <form method="POST" action="{{ route('groups.join') }}">
                                        @csrf
                                        <input type="hidden" name="group_id" value="{{ $suggestion['id'] }}">
                                        <button type="submit" class="btn btn-primary">Join Group</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    @endforeach
                @else
                    <div class="col-12">
                        <p class="text-muted">No AI group suggestions available. Update your profile or engage more for better recommendations!</p>
                    </div>
                @endif
            </div>
        </div>

        <div class="row">
            @foreach ($groups as $group)
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5>{{ $group->name }}</h5>
                            <p>{{ $group->description }}</p>
                            <span class="badge bg-primary">{{ $group->type }}</span>
                            <span class="badge bg-info">{{ $group->visibility }}</span>
                            <form method="POST" action="{{ route('groups.destroy', $group->id) }}">
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

