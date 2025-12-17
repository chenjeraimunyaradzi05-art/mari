<?php

namespace App\Enums;

enum SocialThreadParticipantRole: string
{
    case Owner = 'owner';
    case Moderator = 'moderator';
    case Member = 'member';
}
