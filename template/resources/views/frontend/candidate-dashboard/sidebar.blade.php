<div class="col-lg-3 col-md-4 col-sm-12">
    <div class="box-nav-tabs nav-tavs-profile mb-5">
        <ul class="nav" role="tablist">
            <li><a class="btn btn-border mb-20 active" href="{{ route('member.dashboard') }}">Dashboard</a>
            </li>
            <li><a class="btn btn-border mb-20" href="{{ route('member.applied-jobs.index') }}">Applied Jobs</a></li>
            <li><a class="btn btn-border mb-20" href="{{ route('member.bookmarked-jobs.index') }}">Bookmarked</a>
            </li>
            <li><a class="btn btn-border mb-20" href="{{ route('member.profile.index') }}">My Profile</a></li>
            <li>
                 <!-- Authentication -->
                 <form method="POST" action="{{ route('logout') }}">
                    @csrf
                <a class="btn btn-border mb-20" onclick="event.preventDefault();
                this.closest('form').submit();" href="{{ route('logout') }}">Logout</a>

                </form>
            </li>
        </ul>

    </div>
</div>
