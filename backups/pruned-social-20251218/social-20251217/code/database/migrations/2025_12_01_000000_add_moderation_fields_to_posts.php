<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class() extends Migration
{
    public function up()
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_flagged')->default(false)->after('visibility');
            $table->text('flag_reasons')->nullable()->after('is_flagged');
            $table->string('moderation_status')->default('approved')->after('flag_reasons');
        });
    }

    public function down()
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['is_flagged', 'flag_reasons', 'moderation_status']);
        });
    }
};
