from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_ENV: str = "demo"
    APP_SECRET_KEY: str = "dev-secret-key-change-in-production"
    APP_DEBUG: bool = True

    # Database
    DATABASE_URL: Optional[str] = None

    # JWT
    JWT_SECRET_KEY: str = "dev-jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Google APIs
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    GOOGLE_ROUTES_API_KEY: Optional[str] = None

    # Firebase
    FIREBASE_SERVER_KEY: Optional[str] = None
    FIREBASE_PROJECT_ID: Optional[str] = None

    # SMS
    SMS_PROVIDER: str = "mock"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    MSG91_API_KEY: Optional[str] = None
    MSG91_SENDER_ID: Optional[str] = None

    # Demo
    DEMO_MODE: bool = True
    DEMO_SEED_ON_START: bool = True

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = False
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60

    @property
    def effective_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # Default to SQLite for demo/local
        db_path = os.path.join(os.path.dirname(__file__), "..", "..", "intellitraffic.db")
        return f"sqlite:///{os.path.abspath(db_path)}"

    @property
    def google_routes_configured(self) -> bool:
        return bool(self.GOOGLE_ROUTES_API_KEY)

    @property
    def firebase_configured(self) -> bool:
        return bool(self.FIREBASE_SERVER_KEY and self.FIREBASE_PROJECT_ID)

    @property
    def sms_configured(self) -> bool:
        return self.SMS_PROVIDER != "mock"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
