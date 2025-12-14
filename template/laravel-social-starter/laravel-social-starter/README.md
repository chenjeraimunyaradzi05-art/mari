# Laravel Social Starter (Women-first HR/Education Platform)

A drop-in feature set for **profiles, feeds, uploads, reels-style videos, follows, reactions, comments, and AI assist** — designed for candidates, trainees, tertiary providers (university/TAFE/RTO), sole traders, companies, and government organisations.

> **Inspiration:** Patterned after popular social UIs (cards, reels, explore) without copying source. Colors use a soft, feminine palette.

## Quick Start

1) Copy the contents of this folder into your Laravel project root, keeping relative paths.
2) `composer require laravel/socialite` *(optional if you need OAuth later)*
3) Run migrations: `php artisan migrate`
4) Build assets: `npm i && npm run build` (or `vite` in dev)
5) Set filesystem disk for media (`.env`): `FILESYSTEM_DISK=public` (or s3) then `php artisan storage:link`
6) Add routes from `routes/social.php` to your `routes/web.php` (or include file).
7) Seed some fake data: `php artisan db:seed --class=SocialDemoSeeder`

## AI Assist (Optional)

- Configure env vars in `.env` matching `config/ai.php` (generic LLM provider).
- If no keys are provided, a **Dummy AI** will generate placeholder captions/tags/moderation.

## Key Entities

- **Profiles**: Polymorphic to `users` and `organizations` with type-specific fields.
- **Organizations**: `university`, `tafe_rto`, `company`, `government`, `sole_trader`.
- **Posts**: image/video/text with AI caption & tags, moderation status.
- **Follows**: any profile ⇄ any profile (user or org).
- **Reactions & Comments**: likes and threaded replies.

## Views

- `resources/views/social/feed/index.blade.php` — home feed
- `resources/views/social/profile/show.blade.php` — public profile
- `resources/views/social/post/create.blade.php` — composer
- `resources/views/components/post-card.blade.php` — reusable card

## Styling

Palette is defined in `resources/css/social.css` using CSS variables (rose, mauve, lavender, blush, midnight).

## License

MIT for this starter. You are responsible for third‑party services and content you upload.
