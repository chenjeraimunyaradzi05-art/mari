<?php

namespace App\Support\Feed;

use App\Support\FeatureFlag;
final class FeedSettings
{
    /**
     * Return the available feed filters with their display metadata.
     *
     * @return (bool|string)[][]
     *
     * @psalm-return list{array{label: 'All activity', value: 'all', enabled: bool}, array{label: 'Following', value: 'following', enabled: bool}, array{label: 'Discovery', value: 'discovery', enabled: bool}, array{label: 'Trending', value: 'trending', enabled: bool}, array{label: 'Sponsored', value: 'sponsored', enabled: bool}, array{label: 'Public', value: 'public', enabled: bool}, array{label: 'Private', value: 'private', enabled: bool}, array{label: 'Media', value: 'media', enabled: bool}}
     */
    public static function filters(): array
    {
        return [
            [
                'label' => 'All activity',
                'value' => 'all',
                'enabled' => FeatureFlag::enabled('social.feed.enabled', true),
            ],
            [
                'label' => 'Following',
                'value' => 'following',
                'enabled' => FeatureFlag::enabled('social.feed.following', true),
            ],
            [
                'label' => 'Discovery',
                'value' => 'discovery',
                'enabled' => FeatureFlag::enabled('social.feed.discovery'),
            ],
            [
                'label' => 'Trending',
                'value' => 'trending',
                'enabled' => FeatureFlag::enabled('social.feed.trending'),
            ],
            [
                'label' => 'Sponsored',
                'value' => 'sponsored',
                'enabled' => FeatureFlag::enabled('social.feed.sponsored'),
            ],
            [
                'label' => 'Public',
                'value' => 'public',
                'enabled' => FeatureFlag::enabled('feed.filters.public', true),
            ],
            [
                'label' => 'Private',
                'value' => 'private',
                'enabled' => FeatureFlag::enabled('feed.filters.private'),
            ],
            [
                'label' => 'Media',
                'value' => 'media',
                'enabled' => FeatureFlag::enabled('feed.filters.media', true),
            ],
        ];
    }

    /**
     * Provide a keyed view of the available filters for quick lookups.
     */
    public static function filtersByValue(): array
    {
        $keyed = [];

        foreach (self::filters() as $filter) {
            $keyed[$filter['value']] = $filter;
        }

        if (isset($keyed['all']) && ! isset($keyed['latest'])) {
            $keyed['latest'] = array_merge($keyed['all'], ['value' => 'latest']);
        }

        return $keyed;
    }

}

