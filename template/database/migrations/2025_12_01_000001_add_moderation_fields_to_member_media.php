<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up()
    {
        Schema::table('member_media', function (Blueprint $table) {
            $table->boolean('is_flagged')->default(false)->after('file_path');
            $table->text('flag_reasons')->nullable()->after('is_flagged');
            $table->string('moderation_status')->default('approved')->after('flag_reasons');
        });
    }

    public function down()
    {
        Schema::table('member_media', function (Blueprint $table) {
            $table->dropColumn(['is_flagged', 'flag_reasons', 'moderation_status']);
        });
    }
};
