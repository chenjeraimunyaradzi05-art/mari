@extends('frontend.layouts.master')

@section('contents')
    <section class="section-box mt-75">
        <div class="breacrumb-cover">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-12">
                        <h2 class="mb-20">Create Job Alert</h2>
                        <ul class="breadcrumbs">
                            <li><a class="home-icon" href="{{ url('/') }}">Home</a></li>
                            <li><a href="{{ route('member.dashboard') }}">Dashboard</a></li>
                            <li><a href="{{ route('member.job-alerts.index') }}">Job Alerts</a></li>
                            <li>Create</li>
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
                        <h3 class="mt-0 mb-15 color-brand-1">Create New Job Alert</h3>
                        <p class="text-muted mb-30">Set up personalized job alerts and let our AI find the perfect opportunities for you</p>

                        <!-- AI Suggestions -->
                        @if(count($suggestions) > 0)
                            <div class="alert alert-info mb-4" style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border: none; color: white; border-radius: 15px;">
                                <h5 style="color: white;"><i class="fas fa-magic me-2"></i>AI Suggestions Based on Your Profile</h5>
                                <p class="mb-2">Try one of these pre-configured alerts:</p>
                                <div class="d-flex flex-wrap gap-2">
                                    @foreach($suggestions as $suggestion)
                                        <button class="btn btn-light btn-sm" onclick="applySuggestion({{ json_encode($suggestion) }})">
                                            <i class="fas fa-sparkles me-1"></i>{{ $suggestion['name'] }}
                                        </button>
                                    @endforeach
                                </div>
                            </div>
                        @endif

                        <form action="{{ route('member.job-alerts.store') }}" method="POST">
                            @csrf

                            <div class="row">
                                <!-- Alert Name -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Alert Name <span class="text-danger">*</span></label>
                                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror"
                                           placeholder="e.g., Senior Laravel Developer Jobs" value="{{ old('name') }}" required>
                                    @error('name')
                                        <div class="invalid-feedback">{{ $message }}</div>
                                    @enderror
                                </div>

                                <!-- Keywords -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Keywords</label>
                                    <input type="text" id="keywords" name="keywords[]" class="form-control"
                                           placeholder="e.g., Laravel, PHP, Vue.js (separate with commas)">
                                    <small class="form-text text-muted">Enter keywords separated by commas. Our AI will find jobs matching these terms.</small>
                                    <div id="keywords-tags" class="mt-2"></div>
                                </div>

                                <!-- Job Categories -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Job Categories</label>
                                    <select name="job_categories[]" class="form-select" multiple size="5">
                                        @foreach($categories as $category)
                                            <option value="{{ $category->id }}" {{ in_array($category->id, old('job_categories', [])) ? 'selected' : '' }}>
                                                {{ $category->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                    <small class="form-text text-muted">Hold Ctrl/Cmd to select multiple</small>
                                </div>

                                <!-- Job Types -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Job Types</label>
                                    <select name="job_types[]" class="form-select" multiple size="5">
                                        @foreach($types as $type)
                                            <option value="{{ $type->id }}" {{ in_array($type->id, old('job_types', [])) ? 'selected' : '' }}>
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
                                            <option value="{{ $role->id }}" {{ in_array($role->id, old('job_roles', [])) ? 'selected' : '' }}>
                                                {{ $role->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Locations -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Preferred Locations</label>
                                    <input type="text" name="locations[]" class="form-control"
                                           placeholder="e.g., New York, Remote, San Francisco (separate with commas)">
                                    <small class="form-text text-muted">Leave empty for all locations</small>
                                </div>

                                <!-- Salary Range -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Minimum Salary</label>
                                    <input type="number" name="min_salary" class="form-control"
                                           placeholder="e.g., 50000" value="{{ old('min_salary') }}" min="0" step="1000">
                                </div>

                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Maximum Salary</label>
                                    <input type="number" name="max_salary" class="form-control"
                                           placeholder="e.g., 100000" value="{{ old('max_salary') }}" min="0" step="1000">
                                </div>

                                <!-- Experience Levels -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">Experience Levels</label>
                                    <select name="experience_levels[]" class="form-select" multiple size="4">
                                        @foreach($experiences as $experience)
                                            <option value="{{ $experience->id }}" {{ in_array($experience->id, old('experience_levels', [])) ? 'selected' : '' }}>
                                                {{ $experience->name }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <!-- Notification Channels -->
                                <div class="col-lg-12 mb-4">
                                    <label class="form-label">How would you like to be notified?</label>
                                    <div class="card" style="border-radius: 10px;">
                                        <div class="card-body">
                                            <div class="form-check mb-2">
                                                <input type="checkbox" name="email_enabled" class="form-check-input" id="email_enabled"
                                                       value="1" {{ old('email_enabled', true) ? 'checked' : '' }}>
                                                <label class="form-check-label" for="email_enabled">
                                                    <i class="fas fa-envelope me-2" style="color: #E91E8C;"></i>
                                                    <strong>Email Notifications</strong>
                                                    <div class="small text-muted">Receive job alerts in your inbox</div>
                                                </label>
                                            </div>
                                            <div class="form-check mb-2">
                                                <input type="checkbox" name="sms_enabled" class="form-check-input" id="sms_enabled"
                                                       value="1" {{ old('sms_enabled') ? 'checked' : '' }}>
                                                <label class="form-check-label" for="sms_enabled">
                                                    <i class="fas fa-sms me-2" style="color: #8B5CF6;"></i>
                                                    <strong>SMS Notifications</strong>
                                                    <div class="small text-muted">Get instant text messages for urgent jobs</div>
                                                </label>
                                            </div>
                                            <div class="form-check">
                                                <input type="checkbox" name="push_enabled" class="form-check-input" id="push_enabled"
                                                       value="1" {{ old('push_enabled') ? 'checked' : '' }}>
                                                <label class="form-check-label" for="push_enabled">
                                                    <i class="fas fa-bell me-2" style="color: #10B981;"></i>
                                                    <strong>Push Notifications</strong>
                                                    <div class="small text-muted">Get browser notifications for new matches</div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Frequency -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Alert Frequency</label>
                                    <select name="frequency" class="form-select" required>
                                        <option value="immediate" {{ old('frequency', 'daily') === 'immediate' ? 'selected' : '' }}>
                                            Immediate (as jobs are posted)
                                        </option>
                                        <option value="daily" {{ old('frequency', 'daily') === 'daily' ? 'selected' : '' }}>
                                            Daily Digest
                                        </option>
                                        <option value="weekly" {{ old('frequency') === 'weekly' ? 'selected' : '' }}>
                                            Weekly Summary
                                        </option>
                                    </select>
                                </div>

                                <!-- Match Threshold -->
                                <div class="col-lg-6 mb-4">
                                    <label class="form-label">Minimum Match Score</label>
                                    <select name="match_threshold" class="form-select">
                                        <option value="50" {{ old('match_threshold', 70) == 50 ? 'selected' : '' }}>50% - Show all relevant jobs</option>
                                        <option value="70" {{ old('match_threshold', 70) == 70 ? 'selected' : '' }}>70% - Good matches (Recommended)</option>
                                        <option value="80" {{ old('match_threshold') == 80 ? 'selected' : '' }}>80% - Very good matches</option>
                                        <option value="90" {{ old('match_threshold') == 90 ? 'selected' : '' }}>90% - Excellent matches only</option>
                                    </select>
                                    <small class="form-text text-muted">Higher threshold = fewer but more relevant alerts</small>
                                </div>

                                <!-- Submit Buttons -->
                                <div class="col-lg-12">
                                    <div class="d-flex gap-2">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-check me-2"></i>Create Alert
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

    @push('scripts')
    <script>
        function applySuggestion(suggestion) {
            document.querySelector('input[name="name"]').value = suggestion.name;

            if (suggestion.keywords && suggestion.keywords.length > 0) {
                document.querySelector('#keywords').value = suggestion.keywords.join(', ');
            }

            // Select categories
            if (suggestion.categories && suggestion.categories.length > 0) {
                const categorySelect = document.querySelector('select[name="job_categories[]"]');
                Array.from(categorySelect.options).forEach(option => {
                    option.selected = suggestion.categories.includes(parseInt(option.value));
                });
            }

            // Select types
            if (suggestion.types && suggestion.types.length > 0) {
                const typeSelect = document.querySelector('select[name="job_types[]"]');
                Array.from(typeSelect.options).forEach(option => {
                    option.selected = suggestion.types.includes(parseInt(option.value));
                });
            }

            // Set locations
            if (suggestion.locations && suggestion.locations.length > 0) {
                document.querySelector('input[name="locations[]"]').value = suggestion.locations.join(', ');
            }

            // Scroll to form
            window.scrollTo({
                top: document.querySelector('form').offsetTop - 100,
                behavior: 'smooth'
            });
        }
    </script>
    @endpush
@endsection
