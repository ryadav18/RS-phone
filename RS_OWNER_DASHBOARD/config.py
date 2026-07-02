import os
from dotenv import load_dotenv

# Load configuration values from file or production platform runtime environments
load_dotenv()

class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY", "prod-security-fallback-secret-2026")
    
    @staticmethod
    def validate():
        if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
            raise ValueError("CRITICAL DATABASE CONFIGURATION ERROR: SUPABASE_URL and SUPABASE_KEY must be provided.")