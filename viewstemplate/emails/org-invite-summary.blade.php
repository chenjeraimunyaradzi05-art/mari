<p>Hi {{ $inviter->name }},</p>

<p>Your recent invitation batch for <strong>{{ $page->name }}</strong> has finished processing.</p>

<ul>
	<li>Total attempts: {{ $summary['total'] }}</li>
	<li>Sent: {{ $summary['sent'] }}</li>
	<li>Queued: {{ $summary['queued'] }}</li>
	<li>Failed: {{ $summary['failed'] }}</li>
</ul>

@if (! empty($summary['by_channel']))
	<p>Breakdown by channel:</p>
	<ul>
		@foreach ($summary['by_channel'] as $channel => $count)
			<li>{{ ucfirst($channel) }}: {{ $count }}</li>
		@endforeach
	</ul>
@endif

@if (! empty($results))
	<table border="1" cellpadding="6" cellspacing="0" width="100%">
		<thead>
			<tr>
				<th align="left">Email</th>
				<th align="left">Channel</th>
				<th align="left">Status</th>
				<th align="left">Notes</th>
			</tr>
		</thead>
		<tbody>
			@foreach ($results as $result)
				<tr>
					<td>{{ $result['email'] }}</td>
					<td>{{ ucfirst($result['channel']) }}</td>
					<td>{{ ucfirst($result['status']) }}</td>
					<td>{{ $result['error'] ?? '—' }}</td>
				</tr>
			@endforeach
		</tbody>
	</table>
@endif

<p>Thanks,<br>{{ config('app.name') }} Team</p>
