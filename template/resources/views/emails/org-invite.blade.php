<p>Hello,</p>

<p>
	@if ($inviterName)
		{{ $inviterName }} has invited you to collaborate on the {{ $organizationName }} organization page on {{ $appName }}.
	@else
		You are invited to collaborate on the {{ $organizationName }} organization page on {{ $appName }}.
	@endif
</p>

@if (! empty($organizationTagline))
	<p><strong>{{ $organizationName }}</strong> – {{ $organizationTagline }}</p>
@endif

@if (! empty($message))
	<p>{!! nl2br(e($message)) !!}</p>
@endif

<p>
	<a href="{{ $acceptUrl }}" target="_blank">View the organization page</a>
</p>

<p>Thanks,<br>{{ $appName }} Team</p>
