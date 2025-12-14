<?php
/**
 * ImagePreview
 * Developer: Munyaradzi Chenjerai
 */

namespace App\View\Components;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

final class ImagePreview extends Component
{
    /**
     * Create a new component instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Get the view / contents that represent the component.
     *
     * @return View
     */
    #[\Override]
    public function render(): View|Closure|string
    {
        return view('components.image-preview');
    }
}

