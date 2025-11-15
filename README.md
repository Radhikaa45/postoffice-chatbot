📮 Post Office Services Chatbot
A simple AI-powered assistant built using HTML, CSS, JavaScript, and Flask
The Post Office Services Chatbot is an interactive web-based assistant designed to answer common postal queries, locate nearby post offices using PIN code or location, and even allow users to upload images of damaged parcels along with a description to generate a complaint.

⭐ Features
💬 1. Answers Basic Queries
The chatbot responds to commonly asked questions such as:
Speed Post / Registered Post
Parcel charges & delivery
Post office timings
Banking & savings schemes
General postal information

📍2.Find Post Office by Location or PIN Code
Users can:
Enter their PIN code, or
Share current location
The chatbot displays:
Post office name
Branch type (HO/SO/BO)
Address
Contact details

📸3.Upload Damaged Parcel Images
Users can upload or capture an image using their camera.Add a written description
Chatbot creates a structured complaint entry.This helps users quickly report postal issues.

🛠️ Tech Stack
Frontend:HTML,CSS,JavaScript
Backend:Flask (Python)

Other:
Local file storage for complaint images
Basic rule-based response handling

📁 Project Structure
postoffice-chatbot/
│── static/
│   ├── styles.css
│   └── script.js
│── templates/
│   ├── index.html
│── uploads/          # Stores uploaded images
│── app.py
│── requirements.txt
│── README.md

🚀 Getting Started
1. Clone the Repository
git clone https://github.com/your-username/postoffice-chatbot.git
cd postoffice-chatbot

2. Install Required Packages
pip install -r requirements.txt

3. Run the Flask App
python app.py

4. Open in Browser
http://127.0.0.1:5000/

🧠 How It Works
→ Query Response
JavaScript sends user queries → Flask processes → Chatbot returns answers
→ Post Office Locator
User enters PIN/location → Flask fetches & displays matching post offices
→ Damage Complaint
User uploads image + description → Flask stores file → Shows confirmation

🔮 Future Improvements
Add multilingual support
Integrate official India Post APIs
Add real-time Speed Post tracking
Use an NLP model for better conversation
Store complaints in a database

🤝 Contributing
Pull requests and suggestions are welcome!

📬 Contact
Radhika Gupta
Email: radhikagupta45ig@gmail.com

