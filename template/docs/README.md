# ATHENA Platform Documentation

## Overview

ATHENA is a comprehensive platform empowering women's economic independence through integrated career, education, financial, and social support.

## Quick Links

- [User Guide](./user-guide/README.md)
- [API Documentation](./api/README.md)
- [Architecture](./architecture/README.md)
- [Deployment](./deployment/README.md)
- [Security](./security/README.md)
- [Contributing](./CONTRIBUTING.md)

## Architecture

### System Components

- **Frontend**: Vue 3 + Tailwind CSS
- **Backend**: Laravel 11 + PHP 8.2
- **Database**: MySQL 8.0 (primary), Redis (cache/queue)
- **Storage**: AWS S3
- **Search**: Elasticsearch 8.0
- **Queue**: Laravel Horizon (Redis)
- **Monitoring**: Grafana + Prometheus + Sentry

### Key Modules

1. **Life Pathways Engine** - Career planning and tracking
2. **Opportunity Radar** - AI-powered job/course/grant matching
3. **Social Network** - Connections, posts, mentorship
4. **Money Hub** - Budgeting, debt management, savings
5. **Housing Portal** - Rentals, homeownership, resources
6. **Vehicle Advisory** - Car financing, dealer matching
7. **Fitness & Wellness** - Body-positive programs, tracking
8. **Business Hub** - Entrepreneurship support, grants

## Getting Started

### Prerequisites

- PHP 8.2+
- Composer 2.x
- Node.js 18+
- MySQL 8.0
- Redis 7.0

### Installation

```bash
# Clone repository
git clone https://github.com/athena/platform.git
cd platform

# Install dependencies
composer install
npm install

# Environment setup
cp .env.example .env
php artisan key:generate

# Database
php artisan migrate --seed

# Assets
npm run dev

# Start server
php artisan serve
```

### Running Tests

```bash
# Unit + Feature tests
php artisan test

# Browser tests
php artisan dusk

# With coverage
php artisan test --coverage --min=80
```

## Deployment

See [Deployment Guide](./deployment/README.md) for production deployment instructions.

## Security

See [Security Policy](./SECURITY.md) for vulnerability reporting and security best practices.

## Support

- **User Support**: <support@athena.com>
- **Technical Issues**: GitHub Issues
- **Slack Community**: athena-platform.slack.com
