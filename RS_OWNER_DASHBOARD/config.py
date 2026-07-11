import os
from dotenv import load_dotenv

# Load local environment parameters
load_dotenv()

class Config:
    # 🚀 SMARTER: Input normalization matrix to prevent space or trailing slash issues
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    SECRET_KEY = os.getenv("SECRET_KEY", "RS_OWNER_SECURE_DASHBOARD_KEY_2026")
    
    @staticmethod
    def validate():
        # Clean checking logic variables integrity
        if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
            raise ValueError(
                "\n=======================================================\n"
                "CRITICAL MATRIX CONFLICT: INFRASTRUCTURE CONFIGURATION FAILED\n"
                "Reason: SUPABASE_URL or SUPABASE_KEY environment parameters are missing.\n"
                "Action Required: Check your Render Dashboard Environment values.\n"
                "======================================================="
            )
        
        # 🚀 SECURITY WARNING: Informs the manager if fallback key is active on production server
        if Config.SECRET_KEY == "RS_OWNER_SECURE_DASHBOARD_KEY_2026" and os.getenv("PORT"):
            print("⚠️ DEVELOPMENT ALERT: System running on fallback SECRET_KEY parameters inside live server environment!")
