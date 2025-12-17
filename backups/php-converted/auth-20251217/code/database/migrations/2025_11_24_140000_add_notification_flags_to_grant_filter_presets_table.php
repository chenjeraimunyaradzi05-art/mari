<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('grant_filter_presets', function (Blueprint $table): void {
            $table->boolean('notify_in_app')->default(true)->after('filters');
            $table->boolean('notify_email')->default(false)->after('notify_in_app');
        });
    }

    public function down(): void
    {
        Schema::table('grant_filter_presets', function (Blueprint $table): void {
            $table->dropColumn(['notify_in_app', 'notify_email']);
        });
    }
};
