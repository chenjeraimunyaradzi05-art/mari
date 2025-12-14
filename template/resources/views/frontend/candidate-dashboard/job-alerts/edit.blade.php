@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Edit Job Alert</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.job-alerts.index') }}">Job Alerts</a></li>
                            <li>Edit</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section-box mt-120">
        <div class="container">
            <div class="row">

                @include('frontend.candidate-dashboard.sidebar')

                <div class="col-lg-9 col-md-8 col-sm-12 col-12 mb-50">
                    <div class="content-single">
                        <div class="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h3 class="mt-0 mb-0 color-brand-1">Edit Job Alert</h3>
                                <p class="text-muted mb-0">Update your alert preferences</p>
                            </div>
                            @if($alert->is_active)
                                <span class="badge bg-success">Active</span>
                            @else
                                <span class="badge bg-secondary">Paused</span>
                            @endif
                        </div>

                        <!-- Alert Stats -->
                        @php
                            $stats = $alert->getAlertStats();
                        @endphp
                        @if($stats['sent'] > 0)
                            <div class="card mb-4" style="border-radius: 15px; border: 2px solid #E91E8C;">
                                <div class="card-body">
                                    <h5 class="mb-3" style="color: #E91E8C;"><i class="fas fa-chart-line me-2"></i>Alert Performance</h5>
                                    <div class="row text-center">
                                        <div class="col-3">
                                            <h3 class="mb-0" style="color: #E91E8C;">{{ $stats['sent'] }}</h3>
                                            <small class="text-muted">Jobs Sent</small>
                                        </div>
                                        <div class="col-3">
                                            <h3 class="mb-0" style="color: #8B5CF6;">{{ $stats['clicked'] }}</h3>
                                            <small class="text-muted">Clicked</small>
                                        </div>
                                        <div class="col-3">
                                            <h3 class="mb-0" style="color: #10B981;">{{ $stats['applied'] }}</h3>
                                            <small class="text-muted">Applied</small>
                                        </div>
                                        <div class="col-3">
                                            <h3 class="mb-0" style="color: #F59E0B;">{{ $alert->getEngagementRate() }}%</h3>
                                            <small class="text-muted">Engagement</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        @endif

                        <form action="{{ route('member.job-alerts.update', $alert->id) }}" method="POST">
                            @csrf
                            @method('PUT')

                            <div class="row">
                                <!-- Alert Name -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Alert Name <span class="text-danger">*</span></label>
                                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror"
                                           value="{{ old('name', $alert->name) }}" required>
                                    @error('name')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                    @enderror
                                </div>

                                <!-- Keywords -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Keywords</label>
                                    <input type="text" name="keywords[]" class="form-control"
                                           value="{{ old('keywords') ? implode(', ', old('keywords')) : ($alert->keywords ? implode(', ', $alert->keywords) : '') }}"
                                           placeholder="e.g., Laravel, PHP, Vue.js (separate with commas)">
                                    <small class="form-text text-muted">Enter keywords separated by commas</small>
                                </div>

                                <!-- Job Categories -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Job Categories</label>
                                    <select name="job_categories[]" class="form-select" multiple size="5">
                                        @foreach($categories as $category)
                                            <option value="{{ $category->id }}"
                                                {{ in_array($category->id, old('job_categories', $alert->job_categories ?? [])) ? 'selected' : '' }}>
                                                {{ $category->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Job Types -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Job Types</label>
                                    <select name="job_types[]" class="form-select" multiple size="5">
                                        @foreach($types as $type)
                                            <option value="{{ $type->id }}"
                                                {{ in_array($type->id, old('job_types', $alert->job_types ?? [])) ? 'selected' : '' }}>
                                                {{ $type->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Job Roles -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Job Roles</label>
                                    <select name="job_roles[]" class="form-select" multiple size="4">
                                        @foreach($roles as $role)
                                            <option value="{{ $role->id }}"
                                                {{ in_array($role->id, old('job_roles', $alert->job_roles ?? [])) ? 'selected' : '' }}>
                                                {{ $role->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Locations -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Preferred Locations</label>
                                    <input type="text" name="locations[]" class="form-control"
                                           value="{{ old('locations') ? implode(', ', old('locations')) : ($alert->locations ? implode(', ', $alert->locations) : '') }}"
                                           placeholder="e.g., New York, Remote, San Francisco">
                                </div>

                                <!-- Salary Range -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Minimum Salary</label>
                                    <input type="number" name="min_salary" class="form-control"
                                           value="{{ old('min_salary', $alert->salary_range['min'] ?? '') }}" min="0" step="1000">
                                </div>

                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Maximum Salary</label>
                                    <input type="number" name="max_salary" class="form-control"
                                           value="{{ old('max_salary', $alert->salary_range['max'] ?? '') }}" min="0" step="1000">
                                </div>

                                <!-- Experience Levels -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Experience Levels</label>
                                    <select name="experience_levels[]" class="form-select" multiple size="4">
                                        @foreach($experiences as $experience)
                                            <option value="{{ $experience->id }}"
                                                {{ in_array($experience->id, old('experience_levels', $alert->experience_levels ?? [])) ? 'selected' : '' }}>
                                                {{ $experience->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Notification Channels -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Notification Channels</label>
                                    <div class="card" style="border-radius: 10px;">
                                        <div class="card-body">
                                            <div class="form-check mb-2">
                                                <input type="checkbox" name="email_enabled" class="form-check-input" id="email_enabled"
                                                       value="1" {{ old('email_enabled', $alert->email_enabled) ? 'checked' : '' }}>
                                                <label class="form-check-label" for="email_enabled">
                                                    <i class="fas fa-envelope me-2" style="color: #E91E8C;"></i>
                                                    <strong>Email Notifications</strong>
                                                </label>
                                            </div>
                                            <div class="form-check mb-2">
                                                <input type="checkbox" name="sms_enabled" class="form-check-input" id="sms_enabled"
                                                       value="1" {{ old('sms_enabled', $alert->sms_enabled) ? 'checked' : '' }}>
                                                <label class="form-check-label" for="sms_enabled">
                                                    <i class="fas fa-sms me-2" style="color: #8B5CF6;"></i>
                                                    <strong>SMS Notifications</strong>
                                                </label>
                                            </div>
                                            <div class="form-check">
                                                <input type="checkbox" name="push_enabled" class="form-check-input" id="push_enabled"
                                                       value="1" {{ old('push_enabled', $alert->push_enabled) ? 'checked' : '' }}>
                                                <label class="form-check-label" for="push_enabled">
                                                    <i class="fas fa-bell me-2" style="color: #10B981;"></i>
                                                    <strong>Push Notifications</strong>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Frequency -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Alert Frequency</label>
                                    <select name="frequency" class="form-select" required>
                                        <option value="immediate" {{ old('frequency', $alert->frequency) === 'immediate' ? 'selected' : '' }}>
                                            Immediate
                                        </option>
                                        <option value="daily" {{ old('frequency', $alert->frequency) === 'daily' ? 'selected' : '' }}>
                                            Daily Digest
                                        </option>
                                        <option value="weekly" {{ old('frequency', $alert->frequency) === 'weekly' ? 'selected' : '' }}>
                                            Weekly Summary
                                        </option>
                                    </select>
                                </div>

                                <!-- Match Threshold -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Minimum Match Score</label>
                                    <select name="match_threshold" class="form-select">
                                        <option value="50" {{ old('match_threshold', $alert->match_threshold) == 50 ? 'selected' : '' }}>50% - Show all</option>
                                        <option value="70" {{ old('match_threshold', $alert->match_threshold) == 70 ? 'selected' : '' }}>70% - Good matches</option>
                                        <option value="80" {{ old('match_threshold', $alert->match_threshold) == 80 ? 'selected' : '' }}>80% - Very good</option>
                                        <option value="90" {{ old('match_threshold', $alert->match_threshold) == 90 ? 'selected' : '' }}>90% - Excellent</option>
                                    </select>
                                </div>

                                <!-- Submit Buttons -->
                                <div class="col-lg-12">
                                    <div class="d-flex gap-2">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-check me-2"></i>Update Alert
                                        </button>
                                        <a href="{{ route('member.job-alerts.index') }}" class="btn btn-outline-secondary">
                                            <i class="fas fa-times me-2"></i>Cancel
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </section>
@endsection
