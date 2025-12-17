@extends('frontend.social.layout')

@php
    use Illuminate\Support\Str;
@endphp

@section('social-content')
<div class="space-y-8">
    <div class="flex items-center justify-between">
        <div>
            <p class="text-sm text-indigo-500 font-semibold uppercase">Mentor & Community Ops</p>
            <h1 class="text-3xl font-extrabold text-slate-900">Safety Control Room</h1>
            <p class="mt-1 text-slate-500">Track repeated offenders, unblock unresolved incidents, and monitor automatic suspensions.</p>
        </div>
        <div class="text-right text-sm text-slate-500">
            <p>Auto suspend window: <span class="font-semibold text-slate-800">{{ $autoSuspendMinutes }} minutes</span></p>
            <p>Repeat threshold: <span class="font-semibold text-slate-800">{{ $repeatThreshold }} incidents</span></p>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
            <p class="text-sm font-semibold text-slate-500">Open incidents</p>
            <p class="mt-2 text-3xl font-bold text-rose-600">{{ number_format($summary['open_incidents']) }}</p>
            <p class="mt-1 text-xs text-slate-400">Requires mentor follow-up</p>
        </div>
        <div class="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
            <p class="text-sm font-semibold text-slate-500">Reports (24h)</p>
            <p class="mt-2 text-3xl font-bold text-indigo-600">{{ number_format($summary['reports_last_day']) }}</p>
            <p class="mt-1 text-xs text-slate-400">New submissions</p>
        </div>
        <div class="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
            <p class="text-sm font-semibold text-slate-500">Repeat offenders</p>
            <p class="mt-2 text-3xl font-bold text-amber-600">{{ number_format($summary['repeat_offenders']) }}</p>
            <p class="mt-1 text-xs text-slate-400">Above threshold</p>
        </div>
        <div class="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
            <p class="text-sm font-semibold text-slate-500">Auto suspensions</p>
            <p class="mt-2 text-3xl font-bold text-emerald-600">{{ number_format($summary['pending_auto_suspensions']) }}</p>
            <p class="mt-1 text-xs text-slate-400">Within countdown window</p>
        </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <p class="text-sm font-semibold text-indigo-500 uppercase">Repeated Offenders</p>
                    <h2 class="text-xl font-bold text-slate-900">Escalation queue</h2>
                </div>
                <span class="text-sm text-slate-500">Last {{ $repeatThreshold }}+ incidents · 14d window</span>
            </div>

            @if($offenders->isEmpty())
                <p class="text-slate-500 text-sm">No repeated offenders crossed the threshold in the last two weeks. 🎉</p>
            @else
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead>
                            <tr class="text-left text-slate-500 uppercase text-xs tracking-wide">
                                <th class="py-2">Account</th>
                                <th class="py-2">Incidents</th>
                                <th class="py-2">Last report</th>
                                <th class="py-2">Auto suspend ETA</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            @foreach($offenders as $offender)
                                <tr>
                                    <td class="py-3">
                                        <div class="flex items-center gap-3">
                                            <img src="{{ $offender['avatar'] }}" alt="{{ $offender['name'] }}" class="h-10 w-10 rounded-full object-cover">
                                            <div>
                                                <p class="font-semibold text-slate-900">{{ $offender['name'] }}</p>
                                                <p class="text-xs text-slate-500">User #{{ $offender['user_id'] }}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-3 font-semibold text-rose-600">{{ $offender['incidents'] }}</td>
                                    <td class="py-3 text-slate-500">{{ optional($offender['last_report_at'])->diffForHumans() }}</td>
                                    <td class="py-3">
                                        @if($offender['eta_minutes'] <= 0)
                                            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                                <i class="fas fa-check-circle"></i>
                                                Eligible now
                                            </span>
                                        @else
                                            <span class="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                                                <i class="fas fa-hourglass-half"></i>
                                                {{ $offender['auto_suspend_at']->diffForHumans(null, true) }}
                                            </span>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>

        <div class="rounded-3xl bg-slate-900 text-white p-6 shadow-xl">
            <p class="text-sm font-semibold text-emerald-300 uppercase tracking-wide">Automatic Suspension Timers</p>
            <h2 class="mt-1 text-2xl font-bold">Countdown Monitor</h2>
            <p class="text-sm text-slate-300 mb-4">We will trigger temporary suspensions automatically when countdowns expire. Mentors can intervene to override or add context.</p>

            @if($suspensions->isEmpty())
                <p class="text-sm text-slate-300">No active timers at the moment.</p>
            @else
                <div class="space-y-4">
                    @foreach($suspensions as $timer)
                        <div class="rounded-2xl bg-white/5 p-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="font-semibold">{{ $timer['name'] }}</p>
                                    <p class="text-xs text-slate-300">User #{{ $timer['user_id'] }}</p>
                                </div>
                                <span class="text-xs uppercase tracking-wide {{ $timer['state'] === 'ready' ? 'text-emerald-300' : 'text-amber-200' }}">
                                    {{ $timer['state'] === 'ready' ? 'Ready' : 'Counting down' }}
                                </span>
                            </div>
                            <div class="mt-3">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-slate-300">Next action</span>
                                    <span class="font-semibold text-white">{{ $timer['auto_suspend_at']->toDayDateTimeString() }}</span>
                                </div>
                                <div class="mt-2 h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    @php
                                        $progress = $timer['eta_minutes'] <= 0
                                            ? 100
                                            : max(5, min(100, (1 - ($timer['eta_minutes'] / $autoSuspendMinutes)) * 100));
                                    @endphp
                                    <div class="h-full bg-gradient-to-r from-amber-200 to-rose-300" style="width: {{ $progress }}%"></div>
                                </div>
                                <p class="mt-2 text-xs text-slate-300">{{ $timer['eta_minutes'] <= 0 ? 'Queued for suspension now' : $timer['auto_suspend_at']->diffForHumans() }}</p>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </div>

    <div class="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <p class="text-sm font-semibold text-rose-500 uppercase">Unresolved Incidents</p>
                <h2 class="text-xl font-bold text-slate-900">Needs mentor follow-up</h2>
            </div>
            <span class="text-sm text-slate-500">Showing {{ $incidents->count() }} latest</span>
        </div>

        @if($incidents->isEmpty())
            <p class="text-slate-500 text-sm">All clear! No outstanding incidents remain open.</p>
        @else
            <div class="space-y-4">
                @foreach($incidents as $incident)
                    <div class="border border-slate-100 rounded-2xl p-4">
                        <div class="flex flex-wrap items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <span class="px-3 py-1 text-xs font-semibold rounded-full
                                    @class([
                                        'bg-rose-50 text-rose-600' => $incident->severity === 'critical',
                                        'bg-amber-50 text-amber-600' => $incident->severity === 'high',
                                        'bg-indigo-50 text-indigo-600' => $incident->severity === 'medium',
                                        'bg-slate-100 text-slate-600' => $incident->severity === 'low',
                                    ])">
                                    {{ ucfirst($incident->severity) }}
                                </span>
                                <p class="font-semibold text-slate-900">{{ $incident->category }}</p>
                            </div>
                            <div class="text-right text-xs text-slate-500">
                                <p>Opened {{ optional($incident->created_at)->diffForHumans() }}</p>
                                <p>Status: <span class="font-semibold text-slate-700">{{ ucfirst($incident->status) }}</span></p>
                            </div>
                        </div>

                        <p class="mt-3 text-sm text-slate-600">{{ Str::limit($incident->description, 240) }}</p>

                        <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span><strong class="text-slate-700">Reporter:</strong> {{ $incident->reporter?->name ?? 'Unknown' }}</span>
                            <span><strong class="text-slate-700">Subject:</strong> {{ $incident->subject?->name ?? 'Unknown user' }}</span>
                            <span><strong class="text-slate-700">Incident ID:</strong> {{ $incident->uuid }}</span>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</div>
@endsection
