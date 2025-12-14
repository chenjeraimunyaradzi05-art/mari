<?php

namespace App\Support\Livewire;

use Illuminate\View\Component;
use RuntimeException;

class FallbackComponent extends Component
{
    /**
     * @return string
     *
     * @psalm-return ''
     */
    public function render()
    {
        return '';
    }

    public function __call(string $name, array $arguments)
    {
        throw new RuntimeException('Livewire is required for interactive dashboard components.');
    }

    public function __get(string $name)
    {
        throw new RuntimeException('Livewire is required for interactive dashboard components.');
    }

    /**
     * @return never
     */
    public function __set(string $name, $value)
    {
        throw new RuntimeException('Livewire is required for interactive dashboard components.');
    }

    /**
     * @return never
     */
    public function dispatch(string $event, ...$payload)
    {
        throw new RuntimeException('Livewire is required for interactive dashboard components.');
    }
}

