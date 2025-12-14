# App\Domains

Domain-oriented namespace root introduced via ADR 0001. Upcoming features should place rich domain logic here, e.g., `App\Domains\Housing` or `App\Domains\Mortgages`, keeping cross-domain infrastructure inside the conventional `App\` tree until dedicated slices emerge.
