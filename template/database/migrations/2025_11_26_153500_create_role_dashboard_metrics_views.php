<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (! $this->isMysql()) {
            return;
        }

        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW role_dashboard_adoption_daily AS
SELECT
    DATE(COALESCE(received_at, created_at)) AS captured_on,
    JSON_UNQUOTE(JSON_EXTRACT(properties, '$.role')) AS role,
    COUNT(*) AS total_views,
    COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(properties, '$.user_id'))) AS unique_members,
    AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.widget_count')) AS DECIMAL(10,2))) AS avg_widgets_per_session
FROM analytics_events
WHERE event = 'role_dashboard.viewed'
GROUP BY captured_on, role;
SQL);

        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW role_dashboard_widget_sla_daily AS
SELECT
    metrics.captured_on,
    metrics.role,
    metrics.widget_key,
    COUNT(*) AS render_events,
    AVG(metrics.duration_ms) AS avg_duration_ms,
    MAX(metrics.duration_ms) AS max_duration_ms,
    SUM(CASE WHEN metrics.duration_ms > 400 THEN 1 ELSE 0 END) AS breaches_over_400ms
FROM (
    SELECT
        DATE(COALESCE(received_at, created_at)) AS captured_on,
        JSON_UNQUOTE(JSON_EXTRACT(properties, '$.role')) AS role,
        JSON_UNQUOTE(JSON_EXTRACT(properties, '$.widget_key')) AS widget_key,
        CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.duration_ms')) AS DECIMAL(10,3)) AS duration_ms
    FROM analytics_events
    WHERE event = 'role_dashboard.widget.rendered'
) AS metrics
WHERE metrics.role IS NOT NULL
  AND metrics.role != ''
  AND metrics.widget_key IS NOT NULL
  AND metrics.widget_key != ''
GROUP BY metrics.captured_on, metrics.role, metrics.widget_key;
SQL);
    }

    public function down(): void
    {
        if (! $this->isMysql()) {
            return;
        }

        DB::statement('DROP VIEW IF EXISTS role_dashboard_widget_sla_daily');
        DB::statement('DROP VIEW IF EXISTS role_dashboard_adoption_daily');
    }

    private function isMysql(): bool
    {
        return str_contains(DB::connection()->getDriverName(), 'mysql');
    }
};
