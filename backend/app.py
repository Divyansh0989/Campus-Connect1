
import os
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from postgrest import APIError
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Allow public API requests from any origin
CORS(app)

# Load Supabase environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# Health check
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Event Management API is running",
        "status": "online"
    }), 200


# 1. GET - Browse all events
@app.route('/api/events', methods=['GET'])
def get_events():
    try:
        response = supabase.table('events').select('*').execute()
        return jsonify(response.data), 200

    except APIError as error:
        return jsonify({"error": str(error)}), 500


# 2. GET - Get event details by ID
@app.route('/api/events/<event_id>', methods=['GET'])
def get_event(event_id):
    try:
        response = (
            supabase.table('events')
            .select('*')
            .eq('id', event_id)
            .execute()
        )

        if not response.data:
            return jsonify({"error": "Event not found"}), 404

        return jsonify(response.data[0]), 200

    except APIError as error:
        return jsonify({"error": str(error)}), 500


# Create a demo user
@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json(silent=True) or {}
    email = data.get('email')

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "A valid email is required"}), 400

    email = email.strip().lower()
    if '@' not in email:
        return jsonify({"error": "A valid email is required"}), 400

    try:
        response = (
            supabase.table('users')
            .insert({"email": email, "role": "student"})
            .execute()
        )

        if not response.data:
            return jsonify({"error": "User could not be created"}), 500

        return jsonify(response.data[0]), 201

    except APIError as error:
        if getattr(error, 'code', None) == '23505':
            return jsonify({"error": "A user with this email already exists"}), 409
        return jsonify({"error": str(error)}), 500


# Host a campus event
@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    timestamp = data.get('timestamp')
    host_id = data.get('organiser_id') or data.get('organizer_id')

    if not isinstance(title, str) or not title.strip() or not isinstance(timestamp, str) or not timestamp.strip():
        return jsonify({"error": "title and timestamp are required"}), 400
    if not host_id:
        return jsonify({"error": "A host user is required"}), 400

    try:
        parsed_timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        if parsed_timestamp.tzinfo is None:
            parsed_timestamp = parsed_timestamp.replace(tzinfo=timezone.utc)
    except ValueError:
        return jsonify({"error": "timestamp must be a valid date and time"}), 400

    capacity = data.get('capacity')
    if capacity not in (None, ''):
        try:
            capacity = int(capacity)
            if capacity < 1:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "capacity must be a positive whole number"}), 400
    else:
        capacity = None

    try:
        host = supabase.table('users').select('id').eq('id', host_id).execute()
        if not host.data:
            return jsonify({"error": "Host user was not found"}), 404

        event_data = {
            "title": title.strip(),
            "timestamp": parsed_timestamp.isoformat(),
            "capacity": capacity,
            "organiser_id": host_id,
        }
        response = supabase.table('events').insert(event_data).execute()
        if not response.data:
            return jsonify({"error": "Event could not be created"}), 500
        return jsonify(response.data[0]), 201
    except APIError as error:
        return jsonify({"error": str(error)}), 500


# 3. POST - Create a registration
@app.route('/api/registrations', methods=['POST'])
def create_registration():
    try:
        data = request.get_json(silent=True)

        if not data or not data.get('user_id') or not data.get('event_id'):
            return jsonify({
                "error": "user_id and event_id are required"
            }), 400

        user_id = data['user_id']
        event_id = data['event_id']

        # Check whether event exists
        event_response = (
            supabase.table('events')
            .select('*')
            .eq('id', event_id)
            .execute()
        )

        if not event_response.data:
            return jsonify({"error": "Event not found"}), 404

        event = event_response.data[0]

        # Check whether user exists
        user_response = (
            supabase.table('users')
            .select('id')
            .eq('id', user_id)
            .execute()
        )

        if not user_response.data:
            return jsonify({"error": "User not found"}), 404

        # Check duplicate registration
        existing = (
            supabase.table('registrations')
            .select('id')
            .eq('user_id', user_id)
            .eq('event_id', event_id)
            .execute()
        )

        if existing.data:
            return jsonify({
                "error": "User already registered for this event"
            }), 409

        # Check event capacity
        registrations = (
            supabase.table('registrations')
            .select('id', count='exact')
            .eq('event_id', event_id)
            .execute()
        )

        registered_count = registrations.count or 0
        capacity = event.get('capacity')

        if capacity is not None and registered_count >= capacity:
            return jsonify({
                "error": "Event capacity is full"
            }), 409

        # Insert registration
        response = (
            supabase.table('registrations')
            .insert({
                "user_id": user_id,
                "event_id": event_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            .execute()
        )

        return jsonify({
            "message": "Registration successful",
            "registration": response.data
        }), 201

    except APIError as error:
        return jsonify({"error": str(error)}), 500


# 4. GET - Get registrations for a user
@app.route('/api/me/registrations', methods=['GET'])
def get_my_registrations():
    try:
        user_id = request.args.get('user_id')

        if not user_id:
            return jsonify({
                "error": "user_id query parameter is required"
            }), 400

        response = (
            supabase.table('registrations')
            .select('*, events(*)')
            .eq('user_id', user_id)
            .execute()
        )

        return jsonify(response.data), 200

    except APIError as error:
        return jsonify({"error": str(error)}), 500


# 5. GET - Get registrations for an event
@app.route('/api/events/<event_id>/registrations', methods=['GET'])
def get_event_registrations(event_id):
    try:
        response = (
            supabase.table('registrations')
            .select('*, users(email)')
            .eq('event_id', event_id)
            .execute()
        )

        return jsonify(response.data), 200

    except APIError as error:
        return jsonify({"error": str(error)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
