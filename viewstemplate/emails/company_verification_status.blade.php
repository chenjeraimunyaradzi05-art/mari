<p>Hi {{ $company->name }},</p>

<p>Your company verification status has been updated to <strong>{{ $verification->status }}</strong>.</p>

@if ($verification->notes)
<p>Notes from the reviewer:</p>
<blockquote>{{ $verification->notes }}</blockquote>
@endif

<p>If you have any questions, please contact support.</p>

<p>Thanks,<br>The Team</p>
