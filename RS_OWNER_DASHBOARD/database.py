import sys
from supabase import create_client, Client
from config import Config

# Trigger configurations validation runtime test
try:
    Config.validate()
except ValueError as e:
    print(str(e))
    sys.exit(1) # Gracefully kill instance loop immediately with precise log indicators

# 🚀 SMARTER: Encapsulated initialization factory client to block obscure stack trace crashes
try:
    supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
except Exception as init_exception:
    print(
        f"\n=======================================================\n"
        f"DATABASE INITIALIZATION EXCEPTION: CLIENT BUILD FAILURE\n"
        f"Details: {str(init_exception)}\n"
        f"Verify if the URL syntax contains valid protocol prefixes (https://).\n"
        f"======================================================="
    )
    sys.exit(1)
