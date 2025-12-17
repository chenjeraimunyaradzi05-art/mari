<?php

namespace App\Enums;

enum SocialMessageType: string
{
    case Text = 'text';
    case Media = 'media';
    case PostShare = 'post_share';
    case Video = 'video';
    case Appointment = 'appointment';
    case Template = 'template';
    case System = 'system';
}
