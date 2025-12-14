# IDE helper: Eloquent stub and regeneration

This project includes an IDE-only helper so static analyzers like Intelephense can resolve the `Eloquent` symbol used in generated files such as `_ide_helper_models.php`.

What was added
- `_ide_helper_eloquent.php` — an IDE-only stub that defines `Eloquent` as extending `\Illuminate\Database\Eloquent\Model`, guarded with `class_exists` so it does not affect runtime.
- `composer.json` autoload.files now includes `_ide_helper_eloquent.php` so it will be part of Composer's files autoloaded sets (useful for IDEs and optional runtime inclusion).

How to enable the autoload file locally

1. Make sure Composer is installed on your machine and on your PATH (or run via `php composer.phar`).
2. From the project root run:

```pwsh
composer dump-autoload
```

That rebuild regenerates the project's Composer autoloader and includes this helper file.

How to regenerate & update model helpers (if using barryvdh/laravel-ide-helper)

- To (re)generate the main IDE helper file:

```pwsh
php artisan ide-helper:generate
```

- To write phpdoc blocks to your Eloquent models:

```pwsh
php artisan ide-helper:models --write
```

- To generate _ide_helper.php meta file used by some IDEs:

```pwsh
php artisan ide-helper:meta
```

General notes
- After adding the stub and running `composer dump-autoload`, reload your editor/intelephense: open the VS Code Command Palette → Developer: Reload Window, or restart the Intelephense extension. That should clear the "Undefined type 'Eloquent'" diagnostics coming from `_ide_helper_models.php`.
- The stub is safe to keep in the project root, and it's intentionally simple so it doesn't interfere with runtime behavior.

If you'd like, I can try to add `composer` to PATH in your environment or run `composer dump-autoload` for you if you give permission — but in this environment Composer isn't available, so you'll need to run that command locally.
