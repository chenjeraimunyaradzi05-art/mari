{{-- login.blade.php Developer: Munyaradzi Chenjerai --}}
@extends('admin.auth.layouts.auth-master')

@section('contents')
<section class="section">
    <div class="container mt-5">
      <div class="row">
        <div class="col-12 col-sm-8 offset-sm-2 col-md-6 offset-md-3 col-lg-6 offset-lg-3 col-xl-4 offset-xl-4">
          <div class="login-brand">
            <img src="{{ config('settings.site_logo') }}" alt="logo" width="200" class="shadow-light">
          </div>

          <div class="card card-primary">
            <div class="card-header"><h4>Login</h4></div>

            <div class="card-body">
            <!-- Session Status -->
            <x-auth-session-status class="mb-4" :status="session('status')" />

            @if ($errors->has('auth0'))
              <div class="alert alert-danger">{{ $errors->first('auth0') }}</div>
            @endif

            @php($auth0Enabled = config('auth0.enabled') && Route::has('admin.auth0.login'))

            @if ($auth0Enabled)
              <a href="{{ route('admin.auth0.login') }}" class="btn btn-success btn-lg btn-block mb-4">
                <i class="fas fa-lock mr-2"></i> Secure Auth0 Login
              </a>

              <div class="text-center text-muted mb-3">
                or use a break-glass credential
              </div>
            @else
              <div class="alert alert-info">
                Auth0 SSO is disabled until credentials are configured. Use the form below to sign in.
              </div>
            @endif

              <form method="POST" action="{{ route('admin.mutiro.login.store') }}">
                @csrf
                <input type="hidden" name="timezone" id="admin-login-timezone" value="">
                <input type="hidden" name="offset_minutes" id="admin-login-offset-minutes" value="">

                <div class="form-group">
                  <label for="email">Email</label>
                  <input id="email" type="email" value="{{ old('email') }}" class="form-control {{ $errors->has('email') ? 'is-invalid' : '' }}" name="email" tabindex="1" required autofocus>

                  <x-input-error :messages="$errors->get('email')" class="mt-2" />
                </div>

                <!-- Password -->
                <div class="form-group">
                  <div class="d-block">
                      <label for="password" class="control-label">Password</label>
                    <div class="float-right">
                      <a href="{{ route('admin.password.request') }}" class="text-small">
                        Forgot Password?
                      </a>
                    </div>
                  </div>
                  <input id="password" type="password" class="form-control" name="password" tabindex="2" required>
                  <x-input-error :messages="$errors->get('password')" class="mt-2" />
                </div>

                <!-- Remember Me -->
                <div class="form-group">
                  <div class="custom-control custom-checkbox">
                    <input type="checkbox" name="remember" class="custom-control-input" tabindex="3" id="remember-me">
                    <label class="custom-control-label" for="remember-me">Remember Me</label>
                  </div>
                </div>

                <div class="form-group">
                  <button type="submit" class="btn btn-primary btn-lg btn-block" tabindex="4">
                    Login
                  </button>
                </div>
              </form>
              <script>
                  document.addEventListener('DOMContentLoaded', function () {
                      var timezoneInput = document.getElementById('admin-login-timezone');
                      var offsetInput = document.getElementById('admin-login-offset-minutes');

                      if (timezoneInput) {
                          var zone = null;
                          try {
                              zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                          } catch (error) {
                              zone = null;
                          }

                          if (zone) {
                              timezoneInput.value = zone;
                          }
                      }

                      if (offsetInput) {
                          offsetInput.value = (new Date().getTimezoneOffset() * -1).toString();
                      }
                  });
              </script>

            </div>
          </div>

          <div class="simple-footer">
            Copyright &copy; websolutionus {{ date('Y') }}
          </div>
        </div>
      </div>
    </div>
  </section>
@endsection
