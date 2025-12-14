<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AI Analytics Report</title>
    
</head>
<body>
    <div class="header">
        <h1>AI System Analytics Report</h1>
        <p>Generated: {{ now()->format('F d, Y H:i:s') }}</p>
        <p>Comprehensive analysis of AI system performance and usage</p>
    </div>

    <!-- Summary Statistics -->
    <div class="section">
        <h2>Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-label">Total AI Requests</div>
                <div class="stat-value">{{ number_format($stats['total_requests']) }}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Today's Requests</div>
                <div class="stat-value">{{ number_format($stats['today_requests']) }}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">This Week</div>
                <div class="stat-value">{{ number_format($stats['this_week_requests']) }}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">This Month</div>
                <div class="stat-value">{{ number_format($stats['this_month_requests']) }}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Active Users Today</div>
                <div class="stat-value">{{ number_format($stats['unique_users_today']) }}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Average Response Time</div>
                <div class="stat-value">{{ number_format($stats['avg_response_time']) }}ms</div>
            </div>
        </div>
    </div>

    <!-- Cache Performance -->
    <div class="section">
        <h2>Cache Performance</h2>
        <div class="metric-row">
            <span class="metric-label">Cache Hit Rate:</span>
            <span class="metric-value">{{ $cacheMetrics['cache_hit_rate'] }}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Cache Hits:</span>
            <span class="metric-value">{{ number_format($cacheMetrics['cache_hits']) }}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Cache Misses:</span>
            <span class="metric-value">{{ number_format($cacheMetrics['cache_misses']) }}</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Memory Usage:</span>
            <span class="metric-value">{{ $cacheMetrics['memory_usage'] }}</span>
        </div>
    </div>

    <!-- Error Tracking -->
    <div class="section">
        <h2>Error Tracking</h2>
        <div class="metric-row">
            <span class="metric-label">Error Rate:</span>
            <span class="metric-value">{{ $errorData['error_rate'] }}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Total Errors:</span>
            <span class="metric-value">{{ number_format($errorData['total_errors']) }}</span>
        </div>
        @if(!empty($errorData['common_errors']))
        <table>
            <thead>
                <tr>
                    <th>Error Type</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                @foreach($errorData['common_errors'] as $error)
                <tr>
                    <td>{{ $error['type'] }}</td>
                    <td>{{ number_format($error['count']) }}</td>
                    <td>{{ $error['percentage'] }}%</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif
    </div>

    <!-- Popular Features -->
    <div class="section">
        <h2>Feature Usage</h2>
        <table>
            <thead>
                <tr>
                    <th>Feature</th>
                    <th>Usage Count</th>
                    <th>Percentage</th>
                    <th>Trend</th>
                </tr>
            </thead>
            <tbody>
                @foreach($popularFeatures as $feature)
                <tr>
                    <td>{{ $feature['name'] }}</td>
                    <td>{{ number_format($feature['usage_count']) }}</td>
                    <td>{{ $feature['percentage'] }}%</td>
                    <td class="trend-{{ strtolower($feature['trend']) }}">{{ $feature['trend'] }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Daily Performance -->
    <div class="section">
        <h2>Daily Performance (Last 7 Days)</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Requests</th>
                    <th>Errors</th>
                    <th>Avg Response Time</th>
                </tr>
            </thead>
            <tbody>
                @foreach($performanceData as $day)
                <tr>
                    <td>{{ $day['date'] }}</td>
                    <td>{{ number_format($day['requests']) }}</td>
                    <td>{{ number_format($day['errors']) }}</td>
                    <td>{{ $day['avg_response_time'] }}ms</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>This report is generated automatically from the AI System Analytics Dashboard</p>
        <p>© {{ now()->year }} JobPilot - Confidential</p>
    </div>
</body>
</html>

