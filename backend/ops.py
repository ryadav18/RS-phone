import os
from flask import Blueprint, request, jsonify
from backend.auth import token_required
from backend.devices import verify_device_access
from database import supabase
from firebase_admin import messaging, exceptions

ops_bp = Blueprint('ops', __name__)

@ops_bp.route('/api/devices/<device_id>/action', methods=['POST'])
@token_required
def dispatch_tactical_command(device_id):
    """
    ⚡ THE FCM INSTANT DISPATCHER
    Bypasses polling queues and triggers zero-lag execution on the Android target.
    """
    if not verify_device_access(request.owner_id, device_id):
        return jsonify({"status": "error", "message": "Access permission denied for this target."}), 403

    data = request.json or {}
    action = data.get('action')

    if not action:
        return jsonify({"status": "error", "message": "Command payload missing."}), 400

    try:
        # 1. Fetch Target's FCM Token from Supabase
        dev_query = supabase.table('devices').select('device_token, name').eq('id', device_id).execute()
        
        if not dev_query.data or not dev_query.data[0].get('device_token'):
            return jsonify({"status": "error", "message": "Target FCM token missing. Device might be offline or unauthorized."}), 404
            
        target_fcm_token = dev_query.data[0]['device_token']
        device_name = dev_query.data[0].get('name', 'Unknown Device')

        # 2. Formulate Silent Data Payload (No UI Notification, purely backend trigger)
        # Using Android High-Priority flag to bypass Doze mode instantly
        message = messaging.Message(
            data={
                'command': action  # Example: "RECORD_AUDIO:60", "FORCE_LOCK", "TAKE_SCREENSHOT"
            },
            token=target_fcm_token,
            android=messaging.AndroidConfig(
                priority='high'
            )
        )

        # 3. Fire to Google Cloud Messaging Server
        response = messaging.send(message)
        print(f"[TACTICAL OPS] Command '{action}' successfully injected to {device_name}. Message ID: {response}", flush=True)

        # 4. Log the action for dashboard audit
        supabase.table('activity_logs').insert({
            "device_id": device_id,
            "event_type": "Tactical Command Dispatched",
            "description": f"Executed zero-lag command: {action}"
        }).execute()

        return jsonify({
            "status": "success", 
            "message": f"Payload delivered via FCM pipeline. Execution initiated.",
            "message_id": response
        }), 200

    except exceptions.FirebaseError as fcm_err:
        print(f"[FCM CRASH] Firebase routing failed: {fcm_err}", flush=True)
        # Handle expired tokens
        if "registration-token-not-registered" in str(fcm_err):
             return jsonify({"status": "error", "message": "FCM Token expired. Target needs to re-sync."}), 410
        return jsonify({"status": "error", "message": f"FCM Gateway failure: {str(fcm_err)}"}), 502

    except Exception as e:
        print(f"[OPS SYSTEM CRASH] {str(e)}", flush=True)
        return jsonify({"status": "error", "message": "Internal command router anomaly."}), 500


# =================================================================================
# LEGACY POLLING ROUTES (Optional fallback for older app versions if needed)
# =================================================================================
device_commands_queue = {}

@ops_bp.route('/api/sync/commands/trigger', methods=['POST'])
def inject_remote_command_legacy():
    # Ye fallback ke liye rakha hai agar FCM fail ho jaye. Par naye app me iski zaroorat nahi padegi.
    token = request.args.get('token')
    data = request.get_json() or {}
    if token not in device_commands_queue:
        device_commands_queue[token] = []
    device_commands_queue[token].append({"command": data.get("command")})
    return jsonify({"status": "success"})

@ops_bp.route('/api/sync/commands', methods=['GET'])
def get_pending_commands_legacy():
    token = request.headers.get('X-Device-Token')
    cmds = device_commands_queue.get(token, [])
    device_commands_queue[token] = []  
    return jsonify({"status": "success", "commands": cmds})
