<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>You're invited</title>
</head>
<body>
	<h1>You're invited to join {{ config('app.name') }}</h1>
	<p>{{ $sender->name }} invited you to connect with their {{ $profile->persona_type }} persona.</p>

	@if(!empty($customMessage))
		<p>{{ $customMessage }}</p>
	@endif

	<p>
		<a href="{{ $ctaUrl }}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:4px;">
			Accept Invite
		</a>
	</p>

	<p>Thanks,<br>{{ config('app.name') }}</p>
</body>
</html>
