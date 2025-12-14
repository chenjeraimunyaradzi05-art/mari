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
        Schema::table('users', function (Blueprint $table) {
            // Change the role column to string to allow more values like 'member'
            // We use change() to modify the existing column
            $table->string('role')->default('candidate')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Revert back to enum if needed, but be careful about data loss if 'member' exists
            // For safety in down(), we might just leave it as string or try to convert back
            // Here we will try to convert back to enum, but this might fail if there are 'member' values.
            // So strictly speaking, down() might be destructive or impossible without data cleanup.
            // We will define it but it might fail if data exists.
            $table->enum('role', ['company', 'candidate'])->default('candidate')->change();
        });
    }
};
