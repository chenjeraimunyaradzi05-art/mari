<div class="tab-pane fade show active" id="home4" role="tabpanel" aria-labelledby="home-tab4">
    <div class="card">
        <form action="{{ route('admin.general-settings.update') }}" method="POST">
            @csrf
            <div class="row">

                <div class="col-md-12">
                    <h5 class="mb-3">Social repost settings</h5>
                </div>

                <div class="col-md-4">
                    <div class="form-group">
                        <label for="social_repost_rate_limit_hours">Repost rate limit (hours)</label>
                        <input id="social_repost_rate_limit_hours" type="number" name="social_repost_rate_limit_hours" min="0" max="168" class="form-control {{ hasError($errors, 'social_repost_rate_limit_hours') }}" value="{{ config('settings.social_repost_rate_limit_hours', config('social.repost.rate_limit_hours')) }}">
                        <x-input-error :messages="$errors->get('social_repost_rate_limit_hours')" class="mt-2" />
                        <small class="form-text text-muted">How many hours to rate-limit reposting the same post by the same profile.</small>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="form-group">
                        <label for="social_repost_blocked_moderation_statuses">Blocked moderation statuses</label>
                        <input id="social_repost_blocked_moderation_statuses" type="text" name="social_repost_blocked_moderation_statuses" class="form-control {{ hasError($errors, 'social_repost_blocked_moderation_statuses') }}" value="{{ config('settings.social_repost_blocked_moderation_statuses', implode(',', config('social.repost.blocked_moderation_statuses', ['pending_review','flagged','rejected']))) }}">
                        <x-input-error :messages="$errors->get('social_repost_blocked_moderation_statuses')" class="mt-2" />
                        <small class="form-text text-muted">Comma-separated moderation statuses that block reposting.</small>
                    </div>
                </div>

                <div class="col-md-4">
                    <div class="form-group">
                        <label for="social_repost_block_on_ai_flags">Block on AI flags</label>
                        <div class="mt-1">
                            <input type="hidden" name="social_repost_block_on_ai_flags" value="0">
                            <input id="social_repost_block_on_ai_flags" type="checkbox" name="social_repost_block_on_ai_flags" value="1" @checked((bool) config('settings.social_repost_block_on_ai_flags', config('social.repost.block_on_ai_flags', true)))>
                            <small class="form-text text-muted d-block">If checked, AI moderation flags can prevent reposting.</small>
                        </div>
                        <x-input-error :messages="$errors->get('social_repost_block_on_ai_flags')" class="mt-2" />
                    </div>
                </div>

                <div class="col-md-12">
                    <div class="form-group">
                        <label for="social_repost_ai_blocked_flags">AI-blocked flags</label>
                        <input id="social_repost_ai_blocked_flags" type="text" name="social_repost_ai_blocked_flags" class="form-control {{ hasError($errors, 'social_repost_ai_blocked_flags') }}" value="{{ config('settings.social_repost_ai_blocked_flags', implode(',', config('social.repost.ai_blocked_flags', ['sexually_explicit','violent']))) }}">
                        <x-input-error :messages="$errors->get('social_repost_ai_blocked_flags')" class="mt-2" />
                        <small class="form-text text-muted">Comma-separated AI moderation flags that should block reposting. Leave blank to block on any AI flag.</small>
                    </div>
                </div>

                <div class="col-md-12">
                    <div class="form-group">
                        <label for="">Site Name</label>
                        <input type="text" class="form-control {{ hasError($errors, 'site_name') }}" name="site_name"  value="{{ config('settings.site_name') }}">
                        <x-input-error :messages="$errors->get('site_name')" class="mt-2" />
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="">Site Email</label>
                        <input type="text" class="form-control {{ hasError($errors, 'site_email') }}" name="site_email"  value="{{ config('settings.site_email') }}">
                        <x-input-error :messages="$errors->get('site_email')" class="mt-2" />
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="">Site Phone</label>
                        <input type="text" class="form-control {{ hasError($errors, 'site_phone') }}" name="site_phone"  value="{{ config('settings.site_phone') }}">
                        <x-input-error :messages="$errors->get('site_phone')" class="mt-2" />
                    </div>
                </div>
                {{-- @dd(config('settings')) --}}
                <div class="col-md-12">
                    <div class="form-group">
                        <label for="">Site Map</label>
                        <input type="text" class="form-control {{ hasError($errors, 'site_map') }}" name="site_map"  value="{{ config('settings.site_map') }}">
                        <x-input-error :messages="$errors->get('site_map')" class="mt-2" />
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="form-group">
                        <label for="">Site Default Currency</label>

                        <select name="site_default_currency" class="form-control select2 {{ hasError($errors, 'site_default_currency') }}">

                            <option value="">Select</option>
                            @foreach (config('currencies.currency_list') as $key => $currency)
                                <option @selected($currency === config('settings.site_default_currency')) value="{{ $currency }}">{{ $currency }}</option>
                            @endforeach

                        </select>
                        <x-input-error :messages="$errors->get('site_default_currency')" class="mt-2" />
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="form-group">
                        <label for="">Currency Icon</label>
                        <input type="text" class="form-control {{ hasError($errors, 'site_currency_icon') }}" name="site_currency_icon"  value="{{ config('settings.site_currency_icon') }}">
                        <x-input-error :messages="$errors->get('site_currency_icon')" class="mt-2" />
                    </div>
                </div>


            </div>
            <div class="form-group">
                <button type="submit" class="btn btn-primary">Update</button>
            </div>
        </form>
    </div>
  </div>
