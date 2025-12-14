<?php

/**
 * PaymentSetting Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $key
 * @property string|null $value
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting whereKey($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PaymentSetting whereValue($value)
 *
 * @mixin \Eloquent
 */
final class PaymentSetting extends Model
{
    use HasFactory;

    protected $fillable = ['key', 'value'];
}
