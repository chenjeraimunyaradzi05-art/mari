<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
	public function up(): void
	{
		Schema::create('org_invite_logs', function (Blueprint $table) {
			$table->id();
			$table->foreignId('org_page_id')->constrained('organization_pages')->cascadeOnDelete();
			$table->string('email');
			$table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
			$table->string('channel')->default('email');
			$table->string('status')->default('pending')->index();
			$table->json('meta')->nullable();
			$table->timestamp('sent_at')->nullable();
			$table->timestamps();
		});
	}

	public function down(): void
	{
		Schema::dropIfExists('org_invite_logs');
	}
};
