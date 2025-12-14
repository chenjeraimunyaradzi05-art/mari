<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('partnership_matches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('listing_partnership_intention_id')->constrained()->cascadeOnDelete();
            $table->foreignId('counterparty_user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('match_score', 5, 2)->nullable();
            $table->text('ai_explanation')->nullable();
            $table->enum('status', ['requested', 'accepted', 'declined'])->default('requested');
            $table->enum('action_required_by', ['initiator', 'counterparty'])->nullable();
            $table->timestamps();

            $table->unique([
                'listing_partnership_intention_id',
                'counterparty_user_id',
            ], 'partnership_matches_unique_pair');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partnership_matches');
    }
};
