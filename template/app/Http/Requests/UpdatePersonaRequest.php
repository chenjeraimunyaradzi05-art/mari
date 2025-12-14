<?php

namespace App\Http\Requests;

use App\Models\Profile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property string|null $persona_type
 * @property string|null $display_name
 * @property string|null $handle
 * @property string|null $bio
 * @property string|null $avatar_path
 * @property string|null $cover_path
 * @property string|null $pronouns
 * @property array<int, mixed>|null $location
 * @property array<int, mixed>|null $gender
 * @property array<int, mixed>|null $age_bracket
 * @property array<int, mixed>|null $goals
 * @property array<int, mixed>|null $goals.*
 * @property array<int, mixed>|null $interests
 * @property array<int, mixed>|null $interests.*
 * @property array<int, mixed>|null $skills
 * @property array<int, mixed>|null $skills.*
 * @property array<int, mixed>|null $health_interests
 * @property string|null $health_interests.*
 */
final class UpdatePersonaRequest extends FormRequest
{

}

