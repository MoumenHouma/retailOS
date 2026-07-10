from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Deliberately has NO database_url field, and never will — PHASE5_INTELLIGENCE_PLAN.md's
    "New infra" section is explicit that this service must never connect to
    Postgres directly. RLS/tenant-scoping is Next.js's job only (see
    src/lib/prisma.ts's withTenant); Next.js exports already-tenant-scoped
    data over HTTP and this service is stateless compute on top of it.
    """

    internal_token: str = "dev-internal-token"

    model_config = SettingsConfigDict(case_sensitive=False)


settings = Settings()
