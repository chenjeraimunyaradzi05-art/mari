<?php

namespace App\Enums;

enum UserPersona: string
{
    case CAREGIVER = 'caregiver';
    case CAREER_SHIFTER = 'career-shifter';
    case EARLY_CAREER = 'early-career';
    case ENTREPRENEUR = 'entrepreneur';
    case STUDENT = 'student';
}
