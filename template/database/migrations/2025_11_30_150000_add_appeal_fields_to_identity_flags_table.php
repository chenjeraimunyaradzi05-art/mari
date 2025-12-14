<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('identity_flags', function (Blueprint $table) {
            $table->text('appeal_text')->nullable()->after('resolution_notes');
            $table->timestamp('appealed_at')->nullable()->after('appeal_text');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('identity_flags', function (Blueprint $table) {
            $table->dropColumn(['appeal_text', 'appealed_at']);
        });
    }
};
