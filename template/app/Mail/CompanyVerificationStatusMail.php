<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\CompanyVerification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\SerializesModels;

final class CompanyVerificationStatusMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Company $company;
    public CompanyVerification $verification;
}

