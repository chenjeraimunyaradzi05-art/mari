@extends('layouts.app')

@section('title', 'Sole-Trader Finance Workspace')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div id="business-finance-workspace-root"
        data-user='@json([
            'id' => $user->id,
            'name' => $user->preferred_name ?? $user->name,
            'pronouns' => $user->pronouns,
            'email' => $user->email,
        ])'
        data-ai="{{ e(json_encode($aiContexts, JSON_THROW_ON_ERROR)) }}"
        data-ai-entry="{{ $aiEntryUrl }}"
        class="pb-16">
        <div class="py-24 text-center text-slate-500">
            <p class="text-sm font-medium">Warming the Athena finance workspace…</p>
        </div>
    </div>
</div>
@endsection
