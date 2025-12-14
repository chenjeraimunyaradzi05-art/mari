<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class() extends Migration
{
    public function up()
    {
        // Create a lightweight SQL view for moderation-related daily metrics
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW moderation_daily_metrics AS
            SELECT
                DATE(received_at) AS day,
                event,
                COUNT(*) AS total
            FROM analytics_events
            WHERE event IN ('moderation.request.created', 'moderation.media.block.under18', 'moderation.block.under18', 'moderation.post.force_private')
            GROUP BY DATE(received_at), event;
        SQL);
    }

    public function down()
    {
        DB::statement('DROP VIEW IF EXISTS moderation_daily_metrics');
    }
};
