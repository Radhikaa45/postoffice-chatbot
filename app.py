from flask import Flask, request, jsonify, render_template, session, send_from_directory
import json
import os
import requests
from requests.exceptions import RequestException
import time
import random
from werkzeug.utils import secure_filename 

app = Flask(__name__)
app.secret_key = 'a_very_secret_key_that_is_hard_to_guess'

# Define file paths
DATA_FILE_PATH = os.path.join(os.path.dirname(__file__), 'data.json')
COMPLAINTS_FILE_PATH = os.path.join(os.path.dirname(__file__), 'complaints.json')

# Configuration for file uploads
UPLOAD_FOLDER = 'uploaded_images'  # Folder to save images
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Cache for storing API responses to avoid repeated calls
PINCODE_CACHE = {}
CACHE_EXPIRY = 3600  


def save_complaint_to_file(record):
    """Loads existing complaints, appends the new record, and saves it back."""
    complaints = []
    
    # 1. Load existing data
    if os.path.exists(COMPLAINTS_FILE_PATH) and os.path.getsize(COMPLAINTS_FILE_PATH) > 0:
        try:
            with open(COMPLAINTS_FILE_PATH, 'r', encoding='utf-8') as f:
                complaints = json.load(f)
        except json.JSONDecodeError:
            print("Warning: complaints.json is empty or invalid. Starting a new log.")
            complaints = []
            
    # 2. Append new record
    complaints.append(record)
    
    # 3. Save the updated list
    try:
        with open(COMPLAINTS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(complaints, f, indent=4)
        print(f"Complaint successfully appended to {COMPLAINTS_FILE_PATH}")
    except Exception as e:
        print(f"ERROR saving complaint to file: {e}")

def load_data():
    """Loads the FAQ data from the data.json file with error handling."""
    try:
        with open(DATA_FILE_PATH, 'r', encoding='utf-8') as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading data.json: {e}")
        return []

def allowed_file(filename):
    """Checks if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def fetch_pincode_data(pincode):
    """Fetches pincode data from API with proper error handling and caching."""
    url = f"https://api.postalpincode.in/pincode/{pincode}"
    
    cached_data = PINCODE_CACHE.get(pincode)
    if cached_data and (time.time() - cached_data['timestamp']) < CACHE_EXPIRY:
        return cached_data['data']
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            'Accept': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not isinstance(data, list) or len(data) == 0:
            raise ValueError("Invalid API response format")
        
        PINCODE_CACHE[pincode] = {
            'data': data,
            'timestamp': time.time()
        }
        return data
        
    except RequestException as e:
        print(f"API request failed for pincode {pincode}: {str(e)}")
        return None
    except (ValueError, KeyError, IndexError) as e:
        print(f"Data parsing error for pincode {pincode}: {str(e)}")
        return None

def fetch_pincode_from_location(latitude, longitude):
    """Uses Nominatim API to get a pincode from coordinates."""
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={latitude}&lon={longitude}&zoom=18&addressdetails=1"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if 'address' in data and 'postcode' in data['address']:
            return data['address']['postcode']
        return None
    except RequestException as e:
        print(f"Nominatim API request failed: {str(e)}")
        return None
    except (KeyError, IndexError) as e:
        print(f"Error parsing Nominatim response: {str(e)}")
        return None

@app.route('/')
def home():
    """Renders the main HTML page for the chatbot."""
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serves the file from the UPLOAD_FOLDER for viewing."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"response": "No image file provided for upload.", "options": []}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"response": "No selected image file.", "options": []}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_id = int(time.time() * 1000)
        
        name, ext = os.path.splitext(filename)
        unique_filename = f"{file_id}_{name}{ext}"
        
        upload_path = os.path.join(app.root_path, app.config['UPLOAD_FOLDER'])
        os.makedirs(upload_path, exist_ok=True)
        
        file_path = os.path.join(upload_path, unique_filename)
        file.save(file_path)
        
        session['pending_image_complaint_id'] = file_id 
        session['chatbot_state'] = 'awaiting_image_description'

        return jsonify({
            "response": f"Image '{filename}' uploaded successfully (ID: {file_id}). Please **describe the issue** you are filing a complaint about so I can log it.",
            "options": [] 
        })
    else:
        ext = file.filename.rsplit('.', 1)[1].upper() if '.' in file.filename else 'N/A'
        return jsonify({
            "response": f"The file type ({ext}) is not allowed. Please upload a PNG, JPG, or GIF image.", 
            "options": []
        }), 400


@app.route('/chatbot', methods=['POST'])
def chatbot():
    request_data = request.json
    user_message = request_data.get('message', '').strip().lower()
    latitude = request_data.get('latitude')
    longitude = request_data.get('longitude')
    current_state = session.get('chatbot_state', None)
    
    # --- LOGIC: HANDLE IMAGE DESCRIPTION STATE (Complaint Registration) ---
    if current_state == 'awaiting_image_description':

        image_id = session.pop('pending_image_complaint_id', None)
        session.pop('chatbot_state', None) 
        
        if image_id and user_message:
            
            # Construct the file name hint based on the ID.
            file_path_link_base = f"http://127.0.0.1:5000/uploads/{image_id}_[filename].ext" 
            
            complaint_record = {
                "timestamp": time.time(),
                "image_id": image_id,
                "description": user_message,
                "file_path_link_base": file_path_link_base
            }

            # Save the record to the JSON file
            save_complaint_to_file(complaint_record) # Assuming save_complaint_to_file is defined elsewhere

            print(f"\n--- IMAGE COMPLAINT ID {image_id} LOGGED to complaints.json ---")

            return jsonify({
                "response": f"Complaint successfully logged! Reference ID: {image_id}. Thank you for the description: '{user_message[:50]}...'.",
                "show_upload": False, # <--- CRITICAL FIX: Disable camera after logging
                "options": [
                    {"text": "Track & Trace", "value": "track_trace"},
                    {"text": "Main Menu", "value": "reset"}
                ]
            })
        else:
            return jsonify({
                "response": "I lost the context. Please try uploading the image again or start a new conversation.",
                "show_upload": False, # Disable camera on error/context loss
                "options": [{"text": "Main Menu", "value": "reset"}]
            })
    # --- END LOGIC ---

    # --- RESET CONVERSATION LOGIC ---
    if user_message == 'reset':
        session.pop('chatbot_state', None) 
        session.pop('pending_image_complaint_id', None) 
        
        data = load_data() 

        initial_entry = None
        for entry in data:
            if 'hi' in entry['keywords']:
                initial_entry = entry
                break 

        if initial_entry:
            answer_data = initial_entry.get('answer', {})
            if isinstance(answer_data, dict) and answer_data.get('randomize', False):
                answer = random.choice(answer_data.get('options', ["Hello! Welcome to India Post Assistant."]))
            else:
                answer = "Hello! Welcome to India Post Assistant."

            options = []
            for opt in initial_entry.get('options', []):
                if isinstance(opt, dict) and "text" in opt:
                    options.append(opt) 
                elif isinstance(opt, str):
                     options.append({"text": opt, "value": opt.lower().replace(' ', '_')})
            
            return jsonify({
                "response": answer,
                "options": options,
                "show_upload": False # Always disable on reset/main menu
            })
        else:
            return jsonify({
                "response": "Hello! Welcome to India Post Assistant.",
                "options": [
                    {"text": "Track & Trace", "value": "track_trace"}, 
                    {"text": "Find Post Office", "value": "find_nearest_post_office"}, 
                    {"text": "Banking Services", "value": "banking_schemes"}
                ],
                "show_upload": False
            })
    
    # --- LOCATION/PINCODE LOGIC (All set to show_upload: False) ---
    # app.py (Fixed Logic for Location Search)
# ... inside @app.route('/chatbot', methods=['POST']) ...
    if latitude is not None and longitude is not None:
        pincode = fetch_pincode_from_location(latitude, longitude)
        if pincode:
            api_data = fetch_pincode_data(pincode)
            if api_data and api_data[0]['Status'] == 'Success':
                post_offices = api_data[0]['PostOffice']
                if post_offices:
                    options = [{
                        "text": f"{po.get('Name', 'N/A')} ({po.get('BranchType', 'Office')})",
                        "value": f"post_office_{po.get('Name', '').replace(' ', '_')}"
                    } for po in post_offices[:5]]
                    response_msg = f"Found {len(post_offices)} post offices for your location (pincode {pincode}):"
                    if len(post_offices) > 5:
                        response_msg += f" (showing 5 of {len(post_offices)})"
                        
                    # The fix: including 'full_data' to enable card rendering in JS
                    return jsonify({
                        "response": response_msg, 
                        "options": options, 
                        "full_data": post_offices,  
                        "show_upload": False
                    }) 
                else:
                    return jsonify({"response": f"No post offices found for your location (pincode {pincode}).", "options": [], "show_upload": False})
            else:
                return jsonify({"response": "Sorry, I could not find post offices near your location.", "options": [], "show_upload": False})
        else:
            return jsonify({"response": "I could not determine the pincode for your location.", "options": [], "show_upload": False})
    
    if current_state == 'awaiting_pincode':
        if user_message.isdigit() and len(user_message) == 6:
            pincode = user_message
            api_data = fetch_pincode_data(pincode)
            
            if api_data is None:
                return jsonify({"response": "Sorry, we couldn't fetch pincode information at this time. Please enter a valid 6-digit number to try again.", "show_upload": False})
            
            session.pop('chatbot_state', None)
            
            if api_data[0]['Status'] == 'Success':
                post_offices = api_data[0]['PostOffice']
                if post_offices:
                    options = [{
                        "text": f"{po.get('Name', 'N/A')} ({po.get('BranchType', 'Office')})",
                        "value": f"post_office_{po.get('Name', '').replace(' ', '_')}"
                    } for po in post_offices[:5]]
                    
                    response_msg = f"Found {len(post_offices)} post offices for {pincode}. Main offices:"
                    if len(post_offices) > 5:
                        response_msg += f" (showing 5 of {len(post_offices)})"
                    
                    return jsonify({"response": response_msg, "options": options, "full_data": post_offices, "show_upload": False})
                else:
                    return jsonify({"response": f"No post offices found for pincode {pincode}. Please enter another 6-digit number to try again.", "options": [], "show_upload": False})
            else:
                return jsonify({"response": f"Error: {api_data[0].get('Message', 'Pincode not found')}. Please enter a valid 6-digit number to try again.", "options": [], "show_upload": False})
        else:
            return jsonify({"response": "That doesn't look like a valid Pincode. Please enter a 6-digit number.", "options": [], "show_upload": False})
    
    if user_message == 'find_by_pincode':
        session['chatbot_state'] = 'awaiting_pincode'
        return jsonify({"response": "Please enter the 6-digit pincode to search for post offices:", "options": [], "show_upload": False})

    if user_message == 'find_office_by_location':
        return jsonify({"response": "Please share your location to find nearby post offices.", "show_upload": False})
    
    # Fallback to keyword-based responses from the data.json file
    data = load_data()
    for entry in data:
        keywords = [k.lower() for k in entry['keywords']]
        
        is_complaint_intent = any(k in entry.get('keywords', []) for k in ['complaint', 'issue', 'problem', 'raise_complaint', 'damaged']) 
        
        if any(keyword in user_message for keyword in keywords):
            
            answers = entry.get('answer')
            if isinstance(answers, dict) and 'options' in answers:
                answer = random.choice(answers['options'])
            else:
                answer = answers
            response_data = {"response": answer}
            
            if 'options' in entry:
                response_data['options'] = [
                    opt if isinstance(opt, dict) else {"text": opt, "value": opt.lower().replace(' ', '_')}
                    for opt in entry['options']
                ]

            # Enable the camera feature only for complaint-related intents
            response_data['show_upload'] = is_complaint_intent
                 
            return jsonify(response_data)
    
    # Generic fallback if no intent is matched
    return jsonify({
        "response": "I'm not sure I understand. How can I help you?",
        "options": [
            {"text": "Go back", "value": "reset"}
        ],
        "show_upload": False
    })

if __name__ == '__main__':
    # Ensure the required folders exist on startup
    upload_path = os.path.join(os.path.dirname(__file__), UPLOAD_FOLDER)
    os.makedirs(upload_path, exist_ok=True)
    app.run(debug=True)