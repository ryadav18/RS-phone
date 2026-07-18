from flask import Blueprint, request, jsonify
from datetime import datetime
# Apni main app se supabase client aur auth decorator import kar lena
# from app import supabase, token_required 

whatsapp_bp = Blueprint('whatsapp', __name__)

# ==========================================================
# 1. FETCH LOGS (Dashboard Frontend ke liye)
# GET /api/whatsapp/logs
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/logs', methods=['GET'])
# @token_required  <-- Ensure your auth decorator is active
def get_whatsapp_logs():
    device_id = request.args.get('device_id')
    limit = request.args.get('limit', 1000)

    if not device_id:
        return jsonify({"status": "error", "message": "Device ID is missing"}), 400

    try:
        # Supabase se exactly match karke fetch
        response = supabase.table('whatsapp_logs') \
            .select('*') \
            .eq('device_id', device_id) \
            .order('timestamp', desc=True) \
            .limit(limit) \
            .execute()
        
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================================
# 2. NUKE DATABASE (Delete button ke liye)
# DELETE /api/whatsapp/clear
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/clear', methods=['DELETE'])
# @token_required
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
# POST /api/whatsapp/sync
# ==========================================================
@whatsapp_bp.route('/api/whatsapp/sync', methods=['POST'])
# @token_required
def sync_whatsapp():
    # Token check ke baad device ID nikalna
    # If device_id comes from token payload in your system, extract it. Otherwise expect it in JSON.
    data = request.json
    device_id = data.get('device_id') 
    messages = data.get('messages', []) # Android bhejega 'messages' array

    if not device_id:
        return jsonify({"status": "error", "message": "Device ID required"}), 400
    
    if not messages:
        return jsonify({"status": "success", "message": "No new messages to sync"}), 200

    payloads = []
    
    # STRICT MAPPING: Android Keys -> Supabase Columns
    for msg in messages:
        payloads.append({
            "device_id": device_id,
            "number": msg.get("sender", "Unknown"),           # Android 'sender' -> SQL 'number'
            "contact_name": msg.get("contactName", "Unknown"),# Android 'contactName' -> SQL 'contact_name'
            "body": msg.get("message", ""),                   # Android 'message' -> SQL 'body'
            "type": msg.get("type", "inbox"),
            "protocol": msg.get("protocol", "WHATSAPP"),
            "timestamp": msg.get("timestamp")
        })

    try:
        # BATCH INSERT for heavy performance
        supabase.table('whatsapp_logs').insert(payloads).execute()
        return jsonify({"status": "success", "message": f"{len(payloads)} WhatsApp logs synced."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

