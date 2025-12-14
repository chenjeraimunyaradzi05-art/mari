<?php

namespace App\Enums;

enum IdentityFlagStatus: string
{
    case Pending = 'pending';
    case Cleared = 'cleared';
    case Escalated = 'escalated';
    case Dismissed = 'dismissed';
    case Resolved = 'resolved';
    case Banned = 'banned';
}
