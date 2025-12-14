<div class="tab-pane fade" id="pills-women" role="tabpanel" aria-labelledby="pills-women-tab">
    <form action="{{ route('member.profile.women-info.update') }}" method="POST">
        @csrf

        <!-- Personal Identity Section -->
        <div class="card mb-4" style="border-left: 4px solid #E91E8C;">
            <div class="card-header bg-white">
                <h5 class="mb-0" style="color: #E91E8C;">
                    <i class="fas fa-user-circle mr-2"></i>Personal Identity
                </h5>
                <p class="text-muted small mb-0">Let us know how you identify</p>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group select-style">
                            <label class="font-sm color-text-mutted mb-10">Preferred Pronouns *</label>
                            <select name="pronoun_id" class="form-icons select-active {{ $errors->has('pronoun_id') ? 'is-invalid' : '' }}">
                                <option value="">Select pronouns</option>
                                @foreach ($pronouns as $pronoun)
                                    <option @selected($pronoun->id === $candidate?->pronoun_id) value="{{ $pronoun->id }}">
                                        {{ $pronoun->display_name }}
                                    </option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('pronoun_id')" class="mt-2" />
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group select-style">
                            <label class="font-sm color-text-mutted mb-10">Ethnicity</label>
                            <select name="ethnicity_id" class="form-icons select-active {{ $errors->has('ethnicity_id') ? 'is-invalid' : '' }}">
                                <option value="">Prefer not to say</option>
                                @foreach ($ethnicities as $ethnicity)
                                    <option @selected($ethnicity->id === $candidate?->ethnicity_id) value="{{ $ethnicity->id }}">
                                        {{ $ethnicity->name }}
                                    </option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('ethnicity_id')" class="mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Contact & Mobility Section -->
        <div class="card mb-4" style="border-left: 4px solid #8B5CF6;">
            <div class="card-header bg-white">
                <h5 class="mb-0" style="color: #8B5CF6;">
                    <i class="fas fa-mobile-alt mr-2"></i>Contact & Mobility
                </h5>
                <p class="text-muted small mb-0">Your contact details and driving status</p>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label class="font-sm color-text-mutted mb-10">Mobile Number *</label>
                            <input type="text" name="mobile" class="form-control {{ $errors->has('mobile') ? 'is-invalid' : '' }}"
                                   value="{{ $candidate?->mobile }}" placeholder="+61 4XX XXX XXX">
                            <x-input-error :messages="$errors->get('mobile')" class="mt-2" />
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group select-style">
                            <label class="font-sm color-text-mutted mb-10">Driver License Type</label>
                            <select name="driver_license_type_id" class="form-icons select-active {{ $errors->has('driver_license_type_id') ? 'is-invalid' : '' }}">
                                <option value="">Select license type</option>
                                @foreach ($driverLicenses as $license)
                                    <option @selected($license->id === $candidate?->driver_license_type_id) value="{{ $license->id }}">
                                        {{ $license->name }} ({{ $license->code }})
                                    </option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('driver_license_type_id')" class="mt-2" />
                            <small class="text-muted">Select your highest level of Australian driver license</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Family & Personal Status Section -->
        <div class="card mb-4" style="border-left: 4px solid #10B981;">
            <div class="card-header bg-white">
                <h5 class="mb-0" style="color: #10B981;">
                    <i class="fas fa-heart mr-2"></i>Family & Personal Status
                </h5>
                <p class="text-muted small mb-0">Help us understand your personal situation</p>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group select-style">
                            <label class="font-sm color-text-mutted mb-10">Marital Status</label>
                            <select name="marital_status_id" class="form-icons select-active {{ $errors->has('marital_status_id') ? 'is-invalid' : '' }}">
                                <option value="">Prefer not to say</option>
                                @foreach ($maritalStatuses as $status)
                                    <option @selected($status->id === $candidate?->marital_status_id) value="{{ $status->id }}">
                                        {{ $status->name }}
                                    </option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('marital_status_id')" class="mt-2" />
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label class="font-sm color-text-mutted mb-10">Number of Kids</label>
                            <input type="number" name="number_of_kids" min="0" max="20"
                                   class="form-control {{ $errors->has('number_of_kids') ? 'is-invalid' : '' }}"
                                   value="{{ $candidate?->number_of_kids ?? 0 }}">
                            <x-input-error :messages="$errors->get('number_of_kids')" class="mt-2" />
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group select-style">
                            <label class="font-sm color-text-mutted mb-10">Religion/Belief</label>
                            <select name="religion_id" class="form-icons select-active {{ $errors->has('religion_id') ? 'is-invalid' : '' }}">
                                <option value="">Prefer not to say</option>
                                @foreach ($religions as $religion)
                                    <option @selected($religion->id === $candidate?->religion_id) value="{{ $religion->id }}">
                                        {{ $religion->name }}
                                    </option>
                                @endforeach
                            </select>
                            <x-input-error :messages="$errors->get('religion_id')" class="mt-2" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Career Aspirations Section -->
        <div class="card mb-4" style="border-left: 4px solid #F59E0B;">
            <div class="card-header bg-white">
                <h5 class="mb-0" style="color: #F59E0B;">
                    <i class="fas fa-star mr-2"></i>Career Aspirations
                </h5>
                <p class="text-muted small mb-0">Share your dream career goals</p>
            </div>
            <div class="card-body">
                <div class="form-group">
                    <label class="font-sm color-text-mutted mb-10">What's Your Dream Job?</label>
                    <textarea name="dream_job" rows="4"
                              class="form-control {{ $errors->has('dream_job') ? 'is-invalid' : '' }}"
                              placeholder="Describe your ideal role, the impact you want to make, or the career path you're passionate about...">{{ $candidate?->dream_job }}</textarea>
                    <x-input-error :messages="$errors->get('dream_job')" class="mt-2" />
                    <small class="text-muted">This helps us match you with opportunities aligned with your aspirations</small>
                </div>
            </div>
        </div>

        <!-- Work Preferences Section -->
        <div class="card mb-4" style="border-left: 4px solid #6366F1;">
            <div class="card-header bg-white">
                <h5 class="mb-0" style="color: #6366F1;">
                    <i class="fas fa-briefcase mr-2"></i>Work Preferences
                </h5>
                <p class="text-muted small mb-0">Let us know what work arrangements suit you</p>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <div class="form-check" style="padding-left: 0;">
                            <label class="custom-switch">
                                <input type="hidden" name="willing_fifo" value="0">
                                <input type="checkbox" name="willing_fifo" value="1"
                                       @checked($candidate?->willing_fifo)
                                       class="custom-switch-input">
                                <span class="custom-switch-indicator"></span>
                                <span class="custom-switch-description font-sm">
                                    <strong>Willing to work FIFO</strong>
                                    <br>
                                    <small class="text-muted">Fly-In Fly-Out arrangements (mining, remote sites)</small>
                                </span>
                            </label>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-check" style="padding-left: 0;">
                            <label class="custom-switch">
                                <input type="hidden" name="willing_relocate" value="0">
                                <input type="checkbox" name="willing_relocate" value="1"
                                       @checked($candidate?->willing_relocate)
                                       class="custom-switch-input">
                                <span class="custom-switch-indicator"></span>
                                <span class="custom-switch-description font-sm">
                                    <strong>Willing to Relocate</strong>
                                    <br>
                                    <small class="text-muted">Open to moving for the right opportunity</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="font-sm color-text-mutted mb-10">
                        <i class="fas fa-landmark mr-1"></i>Government Service Interest
                    </label>
                    <div class="row">
                        @php
                            $governmentServices = [
                                ['value' => 'federal', 'label' => 'Federal Government', 'icon' => 'flag'],
                                ['value' => 'state', 'label' => 'State Government', 'icon' => 'map-marker-alt'],
                                ['value' => 'local', 'label' => 'Local Council', 'icon' => 'city'],
                                ['value' => 'education', 'label' => 'Public Education', 'icon' => 'graduation-cap'],
                                ['value' => 'healthcare', 'label' => 'Public Healthcare', 'icon' => 'hospital'],
                                ['value' => 'emergency', 'label' => 'Emergency Services', 'icon' => 'ambulance'],
                            ];
                            $selectedServices = $candidate?->willing_government_service ?? [];
                        @endphp
                        @foreach ($governmentServices as $service)
                            <div class="col-md-4 mb-2">
                                <label class="custom-control custom-checkbox">
                                    <input type="checkbox" name="willing_government_service[]"
                                           value="{{ $service['value'] }}"
                                           @checked(in_array($service['value'], $selectedServices))
                                           class="custom-control-input">
                                    <span class="custom-control-label">
                                        <i class="fas fa-{{ $service['icon'] }} mr-1" style="color: #6366F1;"></i>
                                        {{ $service['label'] }}
                                    </span>
                                </label>
                            </div>
                        @endforeach
                    </div>
                    <small class="text-muted">Select all government sectors you're interested in working for</small>
                </div>
            </div>
        </div>

        <div class="box-button mt-15">
            <button type="submit" class="btn btn-apply-big font-md font-bold"
                    style="background: linear-gradient(135deg, #E91E8C 0%, #8B5CF6 100%); border: none;">
                <i class="fas fa-save mr-2"></i>Save Personal Details
            </button>
        </div>
    </form>
</div>



