from supabase import create_client, Client
from config import Config

# Ensure configurations are validated before initializing client
Config.validate()

# Single point of initialization for the application
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)