import os
from flask import Blueprint, request, jsonify
from supabase import create_client, Client

whatsapp_bp = Blueprint('whatsapp', __name__)

# ==========================================================
# 🚀 SECURE SUPABASE INITIALIZATION (Zero-Crash Architecture)
# ==========================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

# Create an independent Supabase instance for this module
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"❌ WhatsApp Module Supabase Engine Failure: {e}", flush=True)
else:
    print("⚠️ WARNING: Supabase Environment Variables Missing in WhatsApp Module!", flush=True)


# ==========================================================
# 1. FETCH LOGS (Dashboard Frontend ke liye)
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/logs', methods=['GET'])
def get_whatsapp_logs():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 1000)

    if not device_id:
        return jsonify({"status": "error", "message": "Device ID is missing"}), 400

    try:
        response = supabase.table('whatsapp_logs') \
            .select('*') \
            .eq('device_id', device_id) \
            .order('timestamp', desc=True) \
            .limit(limit) \
            .execute()
        
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        print(f"WhatsApp Fetch Crash: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database query failed"}), 500


# ==========================================================
# 2. NUKE DATABASE (Delete button ke liye)
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/clear', methods=['DELETE'])
def clear_whatsapp_logs():
    device_id = request.args.get('device_id')

    if not device_id:
        return jsonify({"status": "error", "message": "Device ID is missing"}), 400

    try:
        supabase.table('whatsapp_logs').delete().eq('device_id', device_id).execute()
        return jsonify({"status": "success", "message": "WhatsApp records eradicated."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================================
# 3. INGESTION ENGINE (Android App se data lene ke liye)
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/sync', methods=['POST'])
def sync_whatsapp():
    # 🚀 FIXED: Android sends the token in the HEADER, not in the JSON body.
    device_id = request.headers.get('X-Device-Token')
    
    if not device_id:
        return jsonify({"status": "error", "message": "X-Device-Token Header Required"}), 400
        
    data = request.json or {}
    messages = data.get('messages', []) 

    if not messages:
        return jsonify({"status": "success", "message": "No new messages to sync"}), 200

    payloads = []
    
    for msg in messages:
        payloads.append({
            "device_id": device_id,
            "number": msg.get("sender", "Unknown"),
            "contact_name": msg.get("contactName", "Unknown"),
            "body": msg.get("message", ""),
            "type": msg.get("type", "inbox"),
            "protocol": msg.get("protocol", "WHATSAPP"),
            "timestamp": msg.get("timestamp")
        })

    try:
        # BATCH INSERT for heavy performance
        supabase.table('whatsapp_logs').insert(payloads).execute()
        print(f"✅ WhatsApp Engine: Successfully synced {len(payloads)} messages.", flush=True)
        return jsonify({"status": "success", "message": f"{len(payloads)} WhatsApp logs synced."}), 200
    except Exception as e:
        print(f"❌ WhatsApp Sync Crash: {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Database insert failed"}), 500
