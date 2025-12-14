<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WishList newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WishList newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WishList query()
 * @mixin \Eloquent
 */
final class WishList extends Model
{
    /**
     * @var string
     */
    protected $table = 'wish_lists';

    /**
     * @var array<int, string>
     */
    protected $guarded = [];
}

