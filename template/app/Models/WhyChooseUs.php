<?php
/**
 * WhyChooseUs Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string|null $icon_one
 * @property string|null $title_one
 * @property string|null $sub_title_one
 * @property string|null $icon_two
 * @property string|null $title_two
 * @property string|null $sub_title_two
 * @property string|null $icon_three
 * @property string|null $title_three
 * @property string|null $sub_title_three
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereIconOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereIconThree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereIconTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereSubTitleOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereSubTitleThree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereSubTitleTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereTitleOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereTitleThree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereTitleTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WhyChooseUs whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class WhyChooseUs extends Model
{
    use HasFactory;

    protected $fillable = [
        'id',
        'icon_one',
        'title_one',
        'sub_title_one',
        'icon_two',
        'title_two',
        'sub_title_two',
        'icon_three',
        'title_three',
        'sub_title_three',
    ];
}

