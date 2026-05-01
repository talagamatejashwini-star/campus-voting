from flask import Flask, render_template, request, jsonify, session
import json, os

app = Flask(__name__)
app.secret_key = 'campus_vote_secret_2025'
DB_FILE = 'database.json'

def load_db():
    if not os.path.exists(DB_FILE):
        default = {
            "events": [
                {"id": 1, "name": "Tech Fest 2025",  "category": "tech",   "date": "2025-04-10", "venue": "CSE Block",         "desc": "Annual hackathon & tech expo",       "votes": 00},
                {"id": 2, "name": "Cultural Night",  "category": "music",  "date": "2025-04-15", "venue": "Open Amphitheatre", "desc": "Dance, music & drama performances",  "votes": 00},
                {"id": 3, "name": "Sports Day",      "category": "sports", "date": "2025-04-20", "venue": "College Ground",    "desc": "Inter-department sports meet",        "votes": 00},
                {"id": 4, "name": "Art Exhibition",  "category": "art",    "date": "2025-04-25", "venue": "Gallery Hall",      "desc": "Student artwork showcase",            "votes": 00},
            ],
            "votes": {},
            "students": {}
        }
        save_db(default)
        return default
    with open(DB_FILE) as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login/student', methods=['POST'])
def login_student():
    data = request.json
    sid  = data.get('id','').strip()
    name = data.get('name','').strip()
    dept = data.get('dept','').strip()
    if not sid or not name or not dept:
        return jsonify(success=False, msg='Please fill all fields!')
    db = load_db()
    if sid not in db['students']:
        db['students'][sid] = {'id': sid, 'name': name, 'dept': dept}
        save_db(db)
    session['user'] = db['students'][sid]
    session['role'] = 'student'
    return jsonify(success=True, user=db['students'][sid])

@app.route('/api/login/admin', methods=['POST'])
def login_admin():
    data = request.json
    if data.get('username') == 'admin' and data.get('password') == 'admin123':
        session['user'] = {'id': 'admin', 'name': 'Admin'}
        session['role'] = 'admin'
        return jsonify(success=True)
    return jsonify(success=False, msg='Invalid credentials!')

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(success=True)

@app.route('/api/me')
def me():
    if 'user' in session:
        return jsonify(success=True, user=session['user'], role=session['role'])
    return jsonify(success=False)

@app.route('/api/events')
def get_events():
    db = load_db()
    return jsonify(events=db['events'])

@app.route('/api/events', methods=['POST'])
def add_event():
    if session.get('role') != 'admin':
        return jsonify(success=False, msg='Unauthorized'), 403
    data  = request.json
    name  = data.get('name','').strip()
    cat   = data.get('category','tech')
    date  = data.get('date','')
    venue = data.get('venue','').strip()
    desc  = data.get('desc','').strip()
    if not all([name, date, venue, desc]):
        return jsonify(success=False, msg='All fields required!')
    db = load_db()
    new_id = max((e['id'] for e in db['events']), default=0) + 1
    db['events'].append({'id': new_id, 'name': name, 'category': cat,
                         'date': date, 'venue': venue, 'desc': desc, 'votes': 0})
    save_db(db)
    return jsonify(success=True, msg='Event added!')

@app.route('/api/events/<int:eid>', methods=['DELETE'])
def delete_event(eid):
    if session.get('role') != 'admin':
        return jsonify(success=False, msg='Unauthorized'), 403
    db = load_db()
    db['events'] = [e for e in db['events'] if e['id'] != eid]
    save_db(db)
    return jsonify(success=True)

@app.route('/api/vote/<int:eid>', methods=['POST'])
def cast_vote(eid):
    if session.get('role') != 'student':
        return jsonify(success=False, msg='Login as student to vote!'), 403
    uid = session['user']['id']
    db  = load_db()
    my_votes = db['votes'].get(uid, [])
    if eid in my_votes:
        return jsonify(success=False, msg='Already voted for this event!')
    my_votes.append(eid)
    db['votes'][uid] = my_votes
    for e in db['events']:
        if e['id'] == eid:
            e['votes'] = e.get('votes', 0) + 1
            break
    save_db(db)
    return jsonify(success=True, msg='Vote cast!')

@app.route('/api/my-votes')
def my_votes():
    if 'user' not in session:
        return jsonify(votes=[])
    uid = session['user']['id']
    db  = load_db()
    return jsonify(votes=db['votes'].get(uid, []))

@app.route('/api/stats')
def stats():
    db = load_db()
    return jsonify(
        total_votes=sum(e['votes'] for e in db['events']),
        total_voters=len(db['votes']),
        total_events=len(db['events'])
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)
