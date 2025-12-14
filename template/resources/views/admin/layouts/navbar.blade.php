<nav class="navbar navbar-expand-lg main-navbar">
    <ul class="navbar-nav mr-auto">
        <li><button type="button" data-toggle="sidebar" class="nav-link nav-link-lg btn-icon"><i class="fas fa-bars"></i></button></li>
    </ul>
    <ul class="navbar-nav navbar-right align-items-center">
        <li class="mr-3">
            <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3 nav-btn" data-href="{{ url('/') }}" data-target="_blank">
                <i class="fas fa-external-link-alt mr-1"></i> Visit Site
            </button>
        </li>
        <li class="dropdown"><button type="button" data-toggle="dropdown"
                class="nav-link dropdown-toggle nav-link-lg nav-link-user">
                <img alt="image" src="{{ asset(auth()->guard('admin')->user()->image) }}" class="rounded-circle mr-1" style="border: 2px solid #eee;">
                <div class="d-sm-none d-lg-inline-block text-dark font-weight-bold">{{ auth()->guard('admin')->user()->name }}</div>
            </button>
            <div class="dropdown-menu dropdown-menu-right shadow-sm border-0">
                <div class="dropdown-title">Logged in 5 min ago</div>
                <button type="button" class="dropdown-item has-icon nav-btn" data-href="{{ route('admin.profile.index') }}">
                    <i class="far fa-user"></i> Profile
                </button>
                <button type="button" class="dropdown-item has-icon nav-btn" data-href="{{ route('admin.site-settings.index') }}">
                    <i class="fas fa-cog"></i> Settings
                </button>
                <div class="dropdown-divider"></div>
                <form method="POST" action="{{ route('admin.logout') }}">
                    @csrf
                    <button type="submit" class="dropdown-item has-icon text-danger">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </form>
            </div>
        </li>
    </ul>
</nav>
