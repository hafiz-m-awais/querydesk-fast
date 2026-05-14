from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    resend_api_key: str
    resend_from_email: str = "querydesk@noreply.nu.edu.pk"

    app_name: str = "QueryDesk"
    app_url: str = "http://localhost:3000"
    institution: str = "FAST-NUCES"

    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
