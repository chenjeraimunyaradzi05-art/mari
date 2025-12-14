<?php

namespace App\Console\Commands\Business;

use App\Services\Business\LegalDocumentLabService;
use Illuminate\Console\Command;

final class SyncGrantPackManifestCommand extends Command
{
    protected $signature = 'legal-document-lab:sync-grant-packs {--url=}';

    protected $description = 'Fetch and cache the latest grant pack manifest for the legal document lab.';
}

