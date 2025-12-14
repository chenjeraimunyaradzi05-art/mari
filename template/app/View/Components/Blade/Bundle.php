<?php

namespace App\View\Components\Blade;

use Illuminate\Contracts\View\View;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Config;
use Illuminate\View\Component;

final class Bundle extends Component
{
    public array $assets;

    #[\Override]
    public function shouldRender(): bool
    {
        return ! empty($this->assets);
    }

    #[\Override]
    public function render(): View
    {
        return view('components.blade.bundle');
    }
}

