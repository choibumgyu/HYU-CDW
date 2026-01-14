import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class _Settings(BaseSettings):
    gemini_api_key: str = ""
    cors_origins: list[str] = ["*"]
    
    postgres_user: str
    postgres_password: str
    postgres_db: str
    
    database_url: str = ""
    db_host: str
    db_port: int
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )
    
settings = _Settings()