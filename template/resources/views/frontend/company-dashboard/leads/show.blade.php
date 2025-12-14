@extends('frontend.company-dashboard.dashboard')

@php use Illuminate\Support\Str; @endphp

@section('company_content')
<div class="space-y-6">
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-slate-900">Lead details</h1>
      <p class="text-sm text-slate-500">{{ $lead->contact_name ?? 'Anonymous prospect' }} &middot; {{ Str::headline($lead->type) }} intent</p>
    </div>
    <div class="flex items-center gap-4">
      <div class="text-right">
    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Qualification score</div>
    <div class="text-3xl font-semibold text-slate-900">{{ $lead->qualification_score ?? '--' }}</div>
      </div>
      @if ($lead->qualification_grade)
        <span class="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-indigo-100 text-indigo-700">Grade {{ $lead->qualification_grade }}</span>
      @endif
      @if ($lead->qualification_priority)
        <span class="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full @class([
          'bg-rose-100 text-rose-700' => $lead->qualification_priority === 'urgent',
          'bg-amber-100 text-amber-700' => $lead->qualification_priority === 'high',
          'bg-emerald-100 text-emerald-700' => $lead->qualification_priority === 'standard',
          'bg-slate-100 text-slate-600' => $lead->qualification_priority === 'low',
        ])">{{ Str::headline($lead->qualification_priority) }}</span>
      @endif
    </div>
  </div>

  @if (session('status'))
    <div class="px-4 py-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded">{{ session('status') }}</div>
  @endif

  @if ($errors->any())
    <div class="px-4 py-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded">
      <strong class="block font-semibold mb-1">Update failed</strong>
      <ul class="list-disc list-inside space-y-1">
        @foreach ($errors->all() as $error)
          <li>{{ $error }}</li>
        @endforeach
      </ul>
    </div>
  @endif

  <div class="grid gap-6 md:grid-cols-3">
    <div class="md:col-span-2 space-y-6">
      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Contact summary</h2>
        </div>
        <div class="px-6 py-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</div>
            <div class="mt-1 text-sm text-slate-900">{{ $lead->contact_name ?? 'Anonymous prospect' }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</div>
            <div class="mt-1 text-sm text-slate-900">{{ $lead->contact_email ?? 'Not provided' }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</div>
            <div class="mt-1 text-sm text-slate-900">{{ $lead->contact_phone ?? 'Not provided' }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Captured</div>
            <div class="mt-1 text-sm text-slate-900">{{ optional($lead->submitted_at)->format('M j, Y g:i a') ?? 'Unknown' }}</div>
            <div class="text-xs text-slate-500">{{ $lead->submitted_at?->diffForHumans() ?? 'No timestamp' }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</div>
            <span class="inline-flex items-center px-2.5 py-1 mt-1 text-xs font-medium rounded-full @class([
              'bg-slate-100 text-slate-700' => $lead->status === 'new',
              'bg-emerald-100 text-emerald-700' => $lead->status === 'qualified',
              'bg-sky-100 text-sky-700' => $lead->status === 'contacted',
              'bg-indigo-100 text-indigo-700' => $lead->status === 'nurturing',
              'bg-slate-200 text-slate-600' => $lead->status === 'disqualified',
            ])">{{ Str::headline($lead->status) }}</span>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned to</div>
            <div class="mt-1 text-sm text-slate-900">{{ $lead->assignedUser?->name ?? 'Unassigned' }}</div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Lead message</h2>
          <span class="text-xs text-slate-400">Captured from {{ optional($lead->page)->name ?? 'unknown page' }}</span>
        </div>
        <div class="px-6 py-6">
          @if ($lead->payload['message'] ?? null)
            <p class="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{{ $lead->payload['message'] }}</p>
          @else
            <p class="text-sm text-slate-500">This lead did not include a message.</p>
          @endif
        </div>
      </div>

      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Qualification insights</h2>
          <p class="text-xs text-slate-500 mt-1">Drivers that influenced the AI qualification score.</p>
        </div>
        <div class="px-6 py-6 space-y-4">
          @if (!empty($lead->qualification_factors))
            @foreach ($lead->qualification_factors as $factor)
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold @class([
                  'bg-emerald-100 text-emerald-700' => ($factor['impact'] ?? 0) >= 0,
                  'bg-rose-100 text-rose-700' => ($factor['impact'] ?? 0) < 0,
                ])">{{ $factor['impact'] ?? 0 }}</span>
                <div>
                  <div class="text-sm font-semibold text-slate-900">{{ $factor['label'] ?? 'Factor' }}</div>
                  <div class="text-xs text-slate-500 mt-1">{{ $factor['reason'] ?? '' }}</div>
                </div>
              </div>
            @endforeach
          @else
            <p class="text-sm text-slate-500">No qualification insights recorded yet.</p>
          @endif
        </div>
      </div>

      @if ($lead->ai_summary || $lead->ai_recommendations)
        <div class="bg-white rounded shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200">
            <h2 class="text-lg font-semibold text-slate-900">AI guidance</h2>
            <p class="text-xs text-slate-500 mt-1">Auto-generated summary and recommended next steps.</p>
          </div>
          <div class="px-6 py-6 space-y-4">
            @if ($lead->ai_summary)
              <div>
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Summary</div>
                <p class="mt-2 text-sm leading-relaxed text-slate-700">{{ $lead->ai_summary }}</p>
              </div>
            @endif

            @if ($lead->ai_recommendations)
              @php
                $recommendationLines = array_filter(preg_split('/\r?\n/', (string) $lead->ai_recommendations));
              @endphp
              @if (!empty($recommendationLines))
                <div>
                  <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recommended actions</div>
                  <ul class="mt-2 space-y-2 text-sm text-slate-700 list-disc list-inside">
                    @foreach ($recommendationLines as $line)
                      <li>{{ trim($line) }}</li>
                    @endforeach
                  </ul>
                </div>
              @endif
            @endif
          </div>
        </div>
      @endif

      @if ($lead->utm || ($lead->payload['landing_url'] ?? null))
        <div class="bg-white rounded shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200">
            <h2 class="text-lg font-semibold text-slate-900">Attribution data</h2>
            <p class="text-xs text-slate-500 mt-1">UTM parameters and landing page context.</p>
          </div>
          <div class="px-6 py-6 space-y-3">
            @if ($lead->payload['landing_url'] ?? null)
              <div>
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Landing URL</div>
                <a href="{{ $lead->payload['landing_url'] }}" target="_blank" rel="noopener" class="mt-1 text-sm text-brand-600 break-all hover:text-brand-700">{{ $lead->payload['landing_url'] }}</a>
              </div>
            @endif

            @if (!empty($lead->utm))
              <div>
                <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">UTM parameters</div>
                <dl class="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700">
                  @foreach ($lead->utm as $key => $value)
                    <div class="flex justify-between gap-3">
                      <dt class="text-slate-500">{{ Str::of($key)->replace('_', ' ')->title() }}</dt>
                      <dd class="text-slate-900">{{ $value }}</dd>
                    </div>
                  @endforeach
                </dl>
              </div>
            @endif
          </div>
        </div>
      @endif

      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Activity timeline</h2>
          <p class="text-xs text-slate-500 mt-1">{{ $noteCount ? $noteCount.' note'.($noteCount === 1 ? '' : 's').' logged by your team.' : 'Keep a running history of touchpoints and next steps.' }}</p>
        </div>
        <div class="px-6 py-6 space-y-5">
          @forelse ($lead->notes as $note)
            @php
              $isEditing = isset($editingNoteId) && $editingNoteId === $note->id;
              $canManage = !$note->is_system && (int) $note->user_id === (int) auth()->id();
            @endphp
            <div class="border-l-2 pl-4 @class(['border-brand-600' => !$note->is_system, 'border-slate-300' => $note->is_system])">
              <div class="flex flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span class="font-semibold @class(['text-slate-700' => !$note->is_system, 'text-brand-600' => $note->is_system])">
                    {{ $note->is_system ? 'System' : ($note->author?->name ?? 'Team member') }}
                  </span>
                  <span>&middot;</span>
                  <span>{{ optional($note->created_at)->format('M j, Y g:i a') ?? '--' }}</span>
                  <span class="text-slate-400">({{ optional($note->created_at)->diffForHumans() ?? 'No timestamp' }})</span>
                  @if ($note->is_system && data_get($note->metadata, 'type') === 'status_changed')
                    <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">Status update</span>
                  @endif
                </div>

                @if ($note->is_system)
                  <p class="text-sm leading-relaxed text-slate-600">{{ $note->body }}</p>
                @else
                  <p class="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{{ $note->body }}</p>
                @endif

                @if ($canManage)
                  <div class="flex items-center gap-3">
                    <a href="{{ route('company.leads.show', ['lead' => $lead, 'edit_note' => $note->id]) }}" class="text-xs font-semibold text-brand-600 hover:text-brand-700">Edit</a>
                    <form method="POST" action="{{ route('company.leads.notes.destroy', ['lead' => $lead->id, 'note' => $note->id]) }}" onsubmit="return confirm('Delete this note?');">
                      @csrf
                      @method('DELETE')
                      <button type="submit" class="text-xs font-semibold text-rose-600 hover:text-rose-700">Delete</button>
                    </form>
                  </div>
                @endif

                @if ($canManage && $isEditing)
                  <form method="POST" action="{{ route('company.leads.notes.update', ['lead' => $lead->id, 'note' => $note->id, 'edit_note' => $note->id]) }}" class="space-y-2">
                    @csrf
                    @method('PATCH')
                    <textarea id="note_edit_{{ $note->id }}" name="body" rows="4" class="w-full border-slate-300 rounded text-sm" required>{{ old('body', $note->body) }}</textarea>
                    @error('body')
                      <p class="text-xs text-rose-600">{{ $message }}</p>
                    @enderror
                    <div class="flex items-center gap-2">
                      <button type="submit" class="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded hover:bg-brand-700">Save note</button>
                      <a href="{{ route('company.leads.show', $lead) }}" class="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</a>
                    </div>
                  </form>
                @endif
              </div>
            </div>
          @empty
            <p class="text-sm text-slate-500">No notes yet. Log your first update to capture context for future follow ups.</p>
          @endforelse
        </div>
      </div>
    </div>

    <div class="space-y-6">
      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Lead actions</h2>
          <p class="text-xs text-slate-500 mt-1">Update status, assignment, or refresh the AI score.</p>
        </div>
        <div class="px-6 py-6">
          <form method="POST" action="{{ route('company.leads.update', $lead) }}" class="space-y-4">
            @csrf
            @method('PATCH')

            <div>
              <label for="status" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
              <select id="status" name="status" class="mt-1 w-full border-slate-300 rounded text-sm">
                @foreach ($statusOptions as $value => $label)
                  <option value="{{ $value }}" @selected(old('status', $lead->status) === $value)>{{ $label }}</option>
                @endforeach
              </select>
            </div>

            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <input id="assign_to_me" name="assign_to_me" type="checkbox" value="1" class="text-brand-600 border-slate-300 rounded" @checked(old('assign_to_me'))>
                <label for="assign_to_me" class="text-sm text-slate-700">Assign to me</label>
              </div>

              @if ($lead->assignedUser)
                <div class="flex items-center gap-2">
                  <input id="clear_assignment" name="clear_assignment" type="checkbox" value="1" class="text-brand-600 border-slate-300 rounded" @checked(old('clear_assignment'))>
                  <label for="clear_assignment" class="text-sm text-slate-700">Clear current assignment</label>
                </div>
              @endif

              <div class="flex items-center gap-2">
                <input id="requalify" name="requalify" type="checkbox" value="1" class="text-brand-600 border-slate-300 rounded" @checked(old('requalify'))>
                <label for="requalify" class="text-sm text-slate-700">Re-run AI qualification after saving</label>
              </div>
            </div>

            <button type="submit" class="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded hover:bg-brand-700">Save changes</button>
          </form>
        </div>
      </div>

      <div class="bg-white rounded shadow-sm border border-slate-200">
        <div class="px-6 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Log a note</h2>
          <p class="text-xs text-slate-500 mt-1">Notes sync with the activity timeline for shared visibility.</p>
        </div>
        <div class="px-6 py-6">
          <form method="POST" action="{{ route('company.leads.notes.store', $lead) }}" class="space-y-4">
            @csrf
            <div>
              <label for="note_body" class="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</label>
              <textarea id="note_body" name="body" rows="4" class="mt-1 w-full border-slate-300 rounded text-sm" placeholder="Capture next steps, call outcomes, or context for teammates." required>{{ isset($editingNoteId) ? '' : old('body') }}</textarea>
              @error('body')
                <p class="mt-1 text-xs text-rose-600">{{ $message }}</p>
              @enderror
            </div>
            <button type="submit" class="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded hover:bg-brand-700">Add note</button>
          </form>
        </div>
      </div>

      @if ($recentLeads->isNotEmpty())
        <div class="bg-white rounded shadow-sm border border-slate-200">
          <div class="px-6 py-4 border-b border-slate-200">
            <h2 class="text-lg font-semibold text-slate-900">Recent leads</h2>
            <p class="text-xs text-slate-500 mt-1">Quick links to the latest enquiries.</p>
          </div>
          <ul class="px-6 py-4 space-y-3">
            @foreach ($recentLeads as $recent)
              <li class="flex flex-col">
                <a href="{{ route('company.leads.show', $recent) }}" class="text-sm font-medium text-slate-900 hover:text-brand-600">{{ $recent->contact_name ?? 'Anonymous prospect' }}</a>
                <div class="text-xs text-slate-500">{{ Str::headline($recent->qualification_priority ?? 'standard') }} priority &middot; {{ optional($recent->submitted_at)->diffForHumans() ?? 'Unknown' }}</div>
              </li>
            @endforeach
          </ul>
        </div>
      @endif
    </div>
  </div>
</div>
@endsection
