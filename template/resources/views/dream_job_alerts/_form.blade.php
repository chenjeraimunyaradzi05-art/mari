@props(['alert' => null])

<form method="POST" action="{{ $action }}">
    @csrf
    @if(! empty($method) && strtolower($method) !== 'post')
        @method($method)
    @endif

    <div>
        <label for="job_title">Job title</label>
        <input id="job_title" name="job_title" value="{{ old('job_title', $alert->job_title ?? '') }}" />
        @error('job_title')<div>{{ $message }}</div>@enderror
    </div>

    <div>
        <label for="industry">Industry</label>
        <input id="industry" name="industry" value="{{ old('industry', $alert->industry ?? '') }}" />
        @error('industry')<div>{{ $message }}</div>@enderror
    </div>

    <div>
        <label for="location">Location</label>
        <input id="location" name="location" value="{{ old('location', $alert->location ?? '') }}" />
        @error('location')<div>{{ $message }}</div>@enderror
    </div>

    <div>
        <label for="min_salary">Minimum salary</label>
        <input id="min_salary" name="min_salary" type="number" step="0.01" value="{{ old('min_salary', $alert->min_salary ?? '') }}" />
        @error('min_salary')<div>{{ $message }}</div>@enderror
    </div>

    <div>
        <label for="required_skills">Required skills (comma separated)</label>
        <input id="required_skills" name="required_skills" value="{{ old('required_skills', is_array($alert->required_skills ?? null) ? implode(',', $alert->required_skills) : '') }}" />
        @error('required_skills')<div>{{ $message }}</div>@enderror
    </div>

    <div>
        <label for="employment_type">Employment type</label>
        <select id="employment_type" name="employment_type">
            @php
                $options = ['' => 'Select', 'full_time' => 'Full time', 'part_time' => 'Part time', 'contract' => 'Contract', 'casual' => 'Casual', 'apprenticeship' => 'Apprenticeship', 'traineeship' => 'Traineeship'];
                $current = old('employment_type', $alert->employment_type ?? '');
            @endphp
            @foreach($options as $value => $label)
                <option value="{{ $value }}" {{ $current === $value ? 'selected' : '' }}>{{ $label }}</option>
            @endforeach
        </select>
    </div>

    <div>
        <label>
            <input type="checkbox" name="is_active" value="1" {{ old('is_active', $alert->is_active ?? true) ? 'checked' : '' }} /> Active
        </label>
    </div>

    <div style="margin-top: 1rem;">
        <button type="submit">Save</button>
    </div>
</form>
