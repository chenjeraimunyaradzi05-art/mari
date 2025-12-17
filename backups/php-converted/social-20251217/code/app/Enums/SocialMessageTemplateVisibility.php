<?php

namespace App\Enums;

enum SocialMessageTemplateVisibility: string
{
    case Private = 'private';
    case Team = 'team';
    case Organization = 'organization';
}
