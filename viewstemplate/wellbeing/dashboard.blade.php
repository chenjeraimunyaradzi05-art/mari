@extends('layouts.app')

@section('title', 'Athena Wellbeing Hub')

@section('content')
    <div class="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-white py-10">
        <div class="mx-auto max-w-6xl px-4">
            <div
                id="wellbeing-dashboard-root"
                data-user='@json([
                    'id' => $user->getKey(),
                    'name' => $user->preferred_name ?? $user->name,
                    'pronouns' => $user->pronouns,
                    'timezone' => $user->timezone,
                ])'
                data-interests='@json($interestTags)'
            ></div>
        </div>
    </div>
@endsection
