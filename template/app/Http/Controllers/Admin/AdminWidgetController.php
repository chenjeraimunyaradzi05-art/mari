<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin\Widget;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

final class AdminWidgetController extends Controller
{
    public function index(): View
    {
        $widgets = Widget::orderBy('id', 'desc')->paginate(20);

        return view('admin.widgets.index', compact('widgets'));
    }

    public function create(): View
    {
        return view('admin.widgets.create');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:admin_widgets,slug',
            'settings' => 'nullable|array',
        ]);

        if (empty($data['slug'])) {
            $data['slug'] = str_replace(' ', '-', strtolower($data['name']));
        }

        Widget::create($data);

        return redirect()->route('admin.widgets.index');
    }

    public function edit(Widget $widget): View
    {
        return view('admin.widgets.edit', compact('widget'));
    }

    public function update(Request $request, Widget $widget): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:admin_widgets,slug,'.$widget->id,
            'settings' => 'nullable|array',
        ]);

        $widget->update($data);

        return redirect()->route('admin.widgets.index');
    }

    public function destroy(Widget $widget): RedirectResponse
    {
        $widget->delete();

        return redirect()->route('admin.widgets.index');
    }

    public function show(Widget $widget): View
    {
        return view('admin.widgets.show', compact('widget'));
    }
}
