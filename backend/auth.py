from flask import Blueprint, request, jsonify, session
from database import supabase
import jwt
from datetime import datetime, timedelta
from config import Config
from functools import wraps

auth_bp = Blueprint('auth', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if token and token.startswith('Bearer '):
            token = token.split(" ")[1]
        else:
            token = session.get('session_token')

        if not token:
            return jsonify({"status": "error", "message": "Access Denied: Token missing"}), 401
        
        try:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                return jsonify({"status": "error", "message": "Access Denied: Invalid Authentication Session"}), 401
            request.owner_id = user_response.user.id
            request.owner_email = user_response.user.email
        except Exception as e:
            return jsonify({"status": "error", "message": f"Auth validation failure: {str(e)}"}), 401
            
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    name = data.get('name', '')

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required parameters"}), 400

    try:
        signup_res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "name": name
                }
            }
        })
        if signup_res.user:
            return jsonify({"status": "success", "message": "Owner registered successfully", "user_id": signup_res.user.id}), 201
        return jsonify({"status": "error", "message": "Registration failed"}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"status": "error", "message": "Missing email or password credentials"}), 400

    try:
        login_res = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        if login_res.session:
            session['session_token'] = login_res.session.access_token
            session['owner_id'] = login_res.user.id
            return jsonify({
                "status": "success",
                "message": "Login authorization granted",
                "token": login_res.session.access_token,
                "user": {
                    "id": login_res.user.id,
                    "email": login_res.user.email,
                    "name": login_res.user.user_metadata.get('name', 'RS Owner')
                }
            }), 200
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route('/api/auth/logout', methods=['POST'])
@token_required
def logout():
    try:
        supabase.auth.sign_out()
        session.clear()
        return jsonify({"status": "success", "message": "Session terminated"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route('/api/auth/me', methods=['GET'])
@token_required
def get_me():
    return jsonify({
        "status": "success",
        "owner": {
            "id": request.owner_id,
            "email": request.owner_email
        }
    }), 200