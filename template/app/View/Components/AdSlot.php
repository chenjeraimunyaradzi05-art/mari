<?php

namespace App\View\Components;

use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

final class AdSlot extends Component
{
    public string $position;
    public string $layout;
    public $ads;

    public function __construct($ads = [], string $position = '', string $layout = 'card')
    {
        $this->ads = $ads;
        $this->position = $position;
        $this->layout = $layout;
    }

    #[\Override]
    public function render(): View
    {
        return view('components.ad-slot');
    }
}

