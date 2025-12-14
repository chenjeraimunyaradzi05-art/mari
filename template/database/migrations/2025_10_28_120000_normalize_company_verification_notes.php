<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		if (! Schema::hasTable('companies') || ! Schema::hasColumn('companies', 'verification_notes')) {
			return;
		}

		DB::table('companies')
			->whereNotNull('verification_notes')
			->orderBy('id')
			->lazyById()
			->each(function ($company) {
				$normalized = $this->normalizeNotes($company->verification_notes);

				if ($normalized !== $company->verification_notes) {
					DB::table('companies')
						->where('id', $company->id)
						->update(['verification_notes' => $normalized]);
				}
			});
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		// Normalization is non-destructive; nothing to revert.
	}

	/**
	 * Normalize verification notes for consistent storage.
	 */
	private function normalizeNotes(?string $notes): ?string
	{
		if ($notes === null) {
			return null;
		}

		// Collapse whitespace, normalize newlines, and trim while preserving content.
		$trimmed = trim($notes);
		$normalizedNewlines = preg_replace("/\r\n|\r/", "\n", $trimmed) ?? '';
		$collapsedWhitespace = preg_replace("/\h{2,}/u", ' ', $normalizedNewlines) ?? $normalizedNewlines;

		return $collapsedWhitespace;
	}
};
