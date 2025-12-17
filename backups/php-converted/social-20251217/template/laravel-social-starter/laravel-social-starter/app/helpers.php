<?php
if (!function_exists('vite_asset')) {
    function vite_asset(string $path) {
        // simple fallback path
        return asset(str_replace('resources/', 'build/', $path));
    }
}
