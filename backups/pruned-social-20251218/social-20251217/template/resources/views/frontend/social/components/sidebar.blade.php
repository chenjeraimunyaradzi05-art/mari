@php
	$metrics = $metrics ?? \App\Support\SocialMetrics::forUser(auth()->user());
	$counts = $metrics['counts'];
	$recent = $metrics['recent'];
	$profile = auth()->user()?->socialProfile;
	$brandTone = $profile?->headline ?? $profile?->tagline ?? 'Women building regenerative economies.';
	$brandUpdated = optional($profile?->updated_at)->diffForHumans() ?? 'Just now';
	$networkHealthTiles = [
		[
			'label' => 'Connections',
			'value' => number_format($counts['connections']),
			'hint' => 'Warm introductions ready',
			'icon' => 'fas fa-link',
			'accent' => '#f472b6',
		],
		[
			'label' => 'Pending invites',
			'value' => number_format($counts['pendingInvites']),
			'hint' => 'Clear to unlock matches',
			'icon' => 'fas fa-inbox',
			'accent' => '#fb923c',
		],
		[
			'label' => 'Unread messages',
			'value' => number_format($counts['unreadMessages']),
			'hint' => 'Replies keep trust warm',
			'icon' => 'fas fa-envelope-open-text',
			'accent' => '#facc15',
		],
		[
			'label' => 'New alerts',
			'value' => number_format($counts['unreadNotifications']),
			'hint' => 'Signals awaiting review',
			'icon' => 'fas fa-bell',
			'accent' => '#60a5fa',
		],
	];
@endphp

<div class="welcome-sidebar" style="display:flex;flex-direction:column;gap:1.5rem;">
	<section class="welcome-sidebar__card welcome-sidebar__card--primary" style="background:linear-gradient(135deg,#2b185a,#461867 45%,#7f104e);color:#fff;box-shadow:0 28px 60px -32px rgba(98,0,138,0.55);border:none;padding:1.5rem;margin-bottom:3px;border-radius:1.25rem;">
		<div class="network-health__tiles" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.85rem;margin-bottom:1rem;">
			@foreach($networkHealthTiles as $tile)
				<article style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(6px);">
					<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
						<p style="text-transform:uppercase;font-size:0.65rem;letter-spacing:0.25em;margin:0;color:rgba(255,255,255,0.78);">{{ $tile['label'] }}</p>
						<span style="width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,0.18);display:inline-flex;align-items:center;justify-content:center;color:{{ $tile['accent'] }};">
							<i class="{{ $tile['icon'] }}" aria-hidden="true"></i>
						</span>
					</div>
					<p style="font-size:1.6rem;font-weight:700;margin:0 0 0.5rem 0;color:#fff;">{{ $tile['value'] }}</p>
					<p style="font-size:0.82rem;margin:0;color:rgba(255,255,255,0.8);">{{ $tile['hint'] }}</p>
				</article>
			@endforeach
		</div>
		<div class="d-flex flex-column gap-3 mt-4 pt-3" style="border-top:1px solid rgba(255,255,255,0.2);">
			<button type="button" class="btn btn-light text-uppercase fw-semibold d-flex align-items-center justify-content-between gap-2 shadow-sm" onclick="window.location.href='{{ route('social.feed.preview') }}'">
				<span>Review Relationships</span>
				<i class="fas fa-arrow-up-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>

	<section class="welcome-sidebar__card" style="background:linear-gradient(135deg,#1e3a5f,#2d4a6f 45%,#3d5a7f);color:#fff;box-shadow:0 28px 60px -32px rgba(30,58,95,0.55);border:none;padding:1.5rem;margin-bottom:3px;border-radius:1.25rem;">
		<header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
			<div>
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.25em;color:rgba(255,255,255,0.78);">Contact graph</p>
				<h4 class="fw-bold mb-0" style="color:#fff;">Warm connections</h4>
			</div>
			<span class="badge bg-white text-dark fw-semibold"><i class="fas fa-address-book me-1"></i>Synced</span>
		</header>
		<p class="text-white-75 mb-3" style="font-size:0.9rem;margin-bottom:1rem;">Synced address book contacts that are ready for invites.</p>
		<div class="d-grid gap-3" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:1rem;">
			<div style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);">
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.2em;color:rgba(255,255,255,0.78);margin-bottom:0.5rem;">Reachable</p>
				<p class="fs-4 fw-bold mb-0" style="color:#fff;">0</p>
			</div>
			<div style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);">
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.2em;color:rgba(255,255,255,0.78);margin-bottom:0.5rem;">New this week</p>
				<p class="fs-4 fw-bold mb-0" style="color:#fff;">0</p>
			</div>
		</div>
		<div class="d-flex flex-column gap-3 mt-4 pt-3" style="border-top:1px solid rgba(255,255,255,0.2);">
			<p class="text-white-75 small mb-0" style="margin-bottom:0.75rem;">Sync contacts to unlock smart invitations.</p>
			<button type="button" class="btn btn-light text-uppercase fw-semibold d-flex align-items-center justify-content-between gap-2 shadow-sm" onclick="window.location.href='#'">
				<span>Manage contacts</span>
				<i class="fas fa-arrow-up-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>

	<section class="welcome-sidebar__card" style="background:linear-gradient(135deg,#4a1d5a,#5d2a6f 45%,#6d3a7f);color:#fff;box-shadow:0 28px 60px -32px rgba(74,29,90,0.55);border:none;padding:1.5rem;margin-bottom:3px;border-radius:1.25rem;">
		<header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
			<div>
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.25em;color:rgba(255,255,255,0.78);">Recommendations</p>
				<h4 class="fw-bold mb-0" style="color:#fff;">Likely to say yes</h4>
			</div>
			<button type="button" class="btn btn-sm btn-light rounded-pill" onclick="window.location.reload()">
				<i class="fas fa-sync-alt me-1"></i>Refresh
			</button>
		</header>
		<div class="text-center py-4" style="background:rgba(255,255,255,0.08);border-radius:1.1rem;border:1px dashed rgba(255,255,255,0.2);margin-bottom:1rem;">
			<i class="fas fa-magic fa-2x mb-3" style="color:rgba(255,255,255,0.5);margin-bottom:1rem;"></i></i>
			<p class="text-white-75 mb-0">We will surface new recommendations as soon as we have enough signal.</p>
		</div>
		<div class="d-flex flex-column gap-3 mt-4 pt-3" style="border-top:1px solid rgba(255,255,255,0.2);">
			<button type="button" class="btn btn-light text-uppercase fw-semibold d-flex align-items-center justify-content-between gap-2 shadow-sm" onclick="window.location.href='#'">
				<span>Explore all recommendations</span>
				<i class="fas fa-arrow-up-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>

	<section class="welcome-sidebar__card" style="background:linear-gradient(135deg,#5a1e3a,#6f2d4a 45%,#7f3d5a);color:#fff;box-shadow:0 28px 60px -32px rgba(90,30,58,0.55);border:none;padding:1.5rem;margin-bottom:3px;border-radius:1.25rem;">
		<header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
			<div>
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.25em;color:rgba(255,255,255,0.78);">Brand kit</p>
				<h4 class="fw-bold mb-0" style="color:#fff;">Identity pulse</h4>
			</div>
			<span class="badge bg-white text-dark fw-semibold"><i class="fas fa-clock me-1"></i>Updated {{ $brandUpdated }}</span>
		</header>
		<p class="text-white-75 mb-3" style="font-size:0.9rem;margin-bottom:1rem;">{{ $brandTone }}</p>
		<div class="d-flex flex-column gap-3" style="margin-bottom:1rem;">
			<div style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);">
				<div class="d-flex align-items-center justify-content-between">
					<span class="text-white-75 small">Status</span>
					<strong class="text-white">{{ $profile?->is_visible ? 'Profile live' : 'Hidden from network' }}</strong>
				</div>
			</div>
			<div style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);">
				<div class="d-flex align-items-center justify-content-between">
					<span class="text-white-75 small">Headline</span>
					<strong class="text-white">{{ $profile?->headline ?? $profile?->title ?? 'Add your spotlight headline' }}</strong>
				</div>
			</div>
			<div style="background:rgba(255,255,255,0.1);border-radius:1.1rem;padding:0.9rem 1rem;border:1px solid rgba(255,255,255,0.12);">
				<div class="d-flex align-items-center justify-content-between">
					<span class="text-white-75 small">Video spotlight</span>
					<strong class="text-white">{{ $profile?->profile_video ? 'Uploaded' : 'Add yours' }}</strong>
				</div>
			</div>
		</div>
		@php
			$profileEditRoute = $profile && $profile->username
				? route('social.profiles.edit', $profile->username)
				: route('profile.edit');
		@endphp
		<div class="d-flex flex-column gap-3 mt-4 pt-3" style="border-top:1px solid rgba(255,255,255,0.2);">
			<button type="button" class="btn btn-light text-uppercase fw-semibold d-flex align-items-center justify-content-between gap-2 shadow-sm" onclick="window.location.href='{{ $profileEditRoute }}'">
				<span>Curate your brand kit</span>
				<i class="fas fa-pen" aria-hidden="true"></i>
			</button>
		</div>
	</section>

	@if($recent['connections']->isNotEmpty())
		<section class="welcome-sidebar__card">
			<header class="welcome-sidebar__section">
				<div>
					<p class="welcome-sidebar__eyebrow">Warm intros</p>
					<h4 class="welcome-sidebar__section-title">Recent connections</h4>
				</div>
				<a href="{{ route('member.social.messages') }}" class="welcome-sidebar__link">
					Open inbox
					<i class="fas fa-arrow-right" aria-hidden="true"></i>
				</a>
			</header>
			<ul class="welcome-sidebar__stack">
				@foreach($recent['connections'] as $connection)
					@php
						$profileConnection = $connection->connected_user_id === auth()->id() ? $connection->user : $connection->connectedUser;
					@endphp
					<li>
						<div class="welcome-sidebar__avatar">
							<img src="{{ $profileConnection?->candidate?->image ?? asset('images/default-avatar.png') }}" alt="{{ $profileConnection?->name }}">
						</div>
						<div>
							<p class="welcome-sidebar__item-title">{{ $profileConnection?->name ?? 'Connection' }}</p>
							<p class="welcome-sidebar__item-meta">Connected {{ optional($connection->created_at)->diffForHumans() }}</p>
						</div>
					</li>
				@endforeach
			</ul>
		</section>
	@endif

	@if($recent['notifications']->isNotEmpty())
		<section class="welcome-sidebar__card">
			<header class="welcome-sidebar__section">
				<div>
					<p class="welcome-sidebar__eyebrow">Signals</p>
					<h4 class="welcome-sidebar__section-title">Latest alerts</h4>
				</div>
				<a href="{{ route('member.social.notifications') }}" class="welcome-sidebar__link">
					View all
					<i class="fas fa-arrow-right" aria-hidden="true"></i>
				</a>
			</header>
			<ul class="welcome-sidebar__stack">
				@foreach($recent['notifications'] as $notification)
					<li>
						<div>
							<p class="welcome-sidebar__item-title">{{ $notification->data['title'] ?? ucfirst($notification->type ?? 'Update') }}</p>
							@if(!empty($notification->data['message']))
								<p class="welcome-sidebar__item-meta">{{ $notification->data['message'] }}</p>
							@endif
						</div>
						<span class="welcome-sidebar__pill">
							<i class="fas fa-clock" aria-hidden="true"></i>
							{{ optional($notification->created_at)->diffForHumans() }}
						</span>
					</li>
				@endforeach
			</ul>
		</section>
	@endif

	@if($recent['groups']->isNotEmpty())
		<section class="welcome-sidebar__card">
			<header class="welcome-sidebar__section">
				<div>
					<p class="welcome-sidebar__eyebrow">Communities</p>
					<h4 class="welcome-sidebar__section-title">Groups to nurture</h4>
				</div>
				<a href="{{ route('member.social.groups') }}" class="welcome-sidebar__link">
					Open hub
					<i class="fas fa-arrow-right" aria-hidden="true"></i>
				</a>
			</header>
			<ul class="welcome-sidebar__stack">
				@foreach($recent['groups'] as $membership)
					<li>
						<div>
							<p class="welcome-sidebar__item-title">{{ $membership->group?->name ?? 'Professional Group' }}</p>
							<p class="welcome-sidebar__item-meta">Joined {{ optional($membership->joined_at)->diffForHumans() }}</p>
						</div>
					</li>
				@endforeach
			</ul>
		</section>
	@endif

	<section class="welcome-sidebar__card" style="background:linear-gradient(135deg,#3a1e5a,#4a2d6f 45%,#5a3d7f);color:#fff;box-shadow:0 28px 60px -32px rgba(58,30,90,0.55);border:none;padding:1.5rem;margin-bottom:3px;border-radius:1.25rem;">
		<header class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
			<div>
				<p class="text-uppercase small fw-semibold mb-1" style="letter-spacing:0.25em;color:rgba(255,255,255,0.78);">Daily focus</p>
				<h4 class="fw-bold mb-0" style="color:#fff;">Keep the warmth high</h4>
			</div>
			<span class="badge bg-white text-dark fw-semibold"><i class="fas fa-magic me-1"></i>AI cue</span>
		</header>
		<p class="text-white-75 mb-3" style="font-size:0.9rem;">
			Send two invites, close one loop, and acknowledge a partner win to stay top-of-mind.
		</p>
		<div class="progress mb-3" style="height:8px;background:rgba(255,255,255,0.2);border-radius:999px;">
			<div class="progress-bar" style="width: {{ min(100, max(0, ($counts['pendingInvites'] ?? 0) ? 60 : 30)) }}%;background:#facc15;"></div>
		</div>
		<div class="d-flex flex-column gap-3 mt-4 pt-3" style="border-top:1px solid rgba(255,255,255,0.2);">
			<button type="button" class="btn btn-light text-uppercase fw-semibold d-flex align-items-center justify-content-between gap-2 shadow-sm" onclick="window.location.href='{{ route('member.social.connections') }}'">
				<span>Review Pending Invites</span>
				<i class="fas fa-arrow-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>
</div>
