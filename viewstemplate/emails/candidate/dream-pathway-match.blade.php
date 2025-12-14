@php
    $userName = $interest->user?->preferred_name ?? $interest->user?->name ?? 'there';
    $matchCount = count($matches);
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Dream pathway matches</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #f8fafc; padding: 24px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background: #ffffff; border-radius: 18px; padding: 32px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);">
                    <tr>
                        <td>
                            <p style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.2em; color: #ec4899; margin: 0 0 12px;">
                                Athena Dream Pathways
                            </p>
                            <h1 style="font-size: 24px; margin: 0 0 16px; color: #0f172a;">
                                Hi {{ $userName }}, we found {{ $matchCount }} new warm {{ \Illuminate\Support\Str::plural('lead', $matchCount) }}
                            </h1>
                            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
                                Your pathway “<strong>{{ $interest->title ?? ucfirst(str_replace('_', ' ', $interest->pathway_type)) }}</strong>” quietly matched fresh opportunities.
                                We filtered for women-first roles, trades, and study intakes that align with the intentions you saved.
                            </p>

                            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 24px;">
                                @foreach($matches as $match)
                                    <tr>
                                        <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
                                            <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.25em; color: #94a3b8; margin: 0 0 6px;">
                                                {{ strtoupper($match['type'] ?? 'match') }}
                                            </p>
                                            <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin: 0;">
                                                {{ $match['title'] ?? 'Opportunity' }}
                                            </p>
                                            <p style="font-size: 14px; color: #475569; margin: 4px 0 0;">
                                                @if(!empty($match['provider']))
                                                    {{ $match['provider'] }} ·
                                                @endif
                                                {{ $match['location'] ?? 'Flexible location' }}
                                            </p>
                                            @if(!empty($match['summary']))
                                                <p style="font-size: 14px; color: #64748b; margin: 6px 0 0;">
                                                    {{ $match['summary'] }}
                                                </p>
                                            @endif
                                            @if(!empty($match['deadline']))
                                                <p style="font-size: 12px; color: #ec4899; text-transform: uppercase; letter-spacing: 0.2em; margin: 8px 0 0;">
                                                        Deadline: {{ \Illuminate\Support\Carbon::parse($match['deadline'])->format('M j, Y') }}
                                                </p>
                                            @endif
                                            @if(!empty($match['link']))
                                                <p style="margin: 12px 0 0;">
                                                    <a href="{{ $match['link'] }}"
                                                       style="display: inline-block; padding: 10px 18px; background: #ec4899; color: #fff; text-decoration: none; border-radius: 999px; font-size: 14px;">
                                                        View details
                                                    </a>
                                                </p>
                                            @endif
                                        </td>
                                    </tr>
                                @endforeach
                            </table>

                            <p style="font-size: 15px; color: #475569; margin: 0 0 16px;">
                                You can fine-tune notifications or pause pathways anytime. We’ll keep your intentions private until you choose to share them with a provider.
                            </p>

                            <p>
                                <a href="{{ $ctaUrl }}" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #0ea5e9; color: #fff; text-decoration: none; border-radius: 999px; font-weight: 600;">
                                    <span>Open dream wishlist</span>
                                    <span style="font-size: 16px;">&rarr;</span>
                                </a>
                            </p>

                            <p style="font-size: 13px; color: #94a3b8; margin: 32px 0 0;">
                                Sent with care from the Athena Careers team · Switch notification preferences inside your wishlist dashboard.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
