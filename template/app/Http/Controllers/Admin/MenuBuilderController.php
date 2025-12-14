<?php
/**
 * MenuBuilderController
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

final class MenuBuilderController extends Controller
{
    function __construct()
    {
        $this->middleware(['permission:menu builder']);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): \Illuminate\Contracts\View\View
    {
        return view('admin.menu-builder.index');
    }
}

