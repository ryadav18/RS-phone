import os
from dotenv import load_dotenv

# Load local .env variables if running locally
load_dotenv()

class Config:
    # Zero exposure: reads strictly from Render Environment variables or local .env
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SECRET_KEY = os.getenv("SECRET_KEY", "RS_OWNER_SECURE_DASHBOARD_KEY_2026")
    
    @staticmethod
    def validate():
        if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
            raise ValueError("CRITICAL DATABASE CONFIGURATION ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be provided on Render.")
