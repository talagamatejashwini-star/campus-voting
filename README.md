# 🎓 Campus Voting System

A full-stack Python + Flask web application for campus event voting.

## Project Structure
```
campus_voting/
├── app.py              # Flask backend (API + routes)
├── requirements.txt    # Python dependencies
├── database.json       # Auto-created JSON database
└── templates/
    └── index.html      # Frontend (HTML + CSS + JS)
```

## Setup & Run

### 1. Install Python (if not installed)
Download from https://python.org

### 2. Install Flask
Open terminal/command prompt in the project folder and run:
```
pip install flask
```

### 3. Run the server
```
python app.py
```

### 4. Open in Chrome
Go to: http://localhost:5000

## Login Credentials
- **Student**: Any Student ID + Name + Department
- **Admin**: username = `admin`, password = `admin123`

## Features
- Student login & voting (one vote per event)
- Live results leaderboard
- Admin panel: add/delete events
- Data stored in database.json (persists across restarts)
