from flask import Flask, jsonify, send_from_directory, request, session, send_file, Response
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_session import Session
from werkzeug.utils import secure_filename
from functools import wraps
import os
import sqlite3
import json
import asyncio
from playwright.async_api import async_playwright
import base64
from io import BytesIO
import threading
import requests
from urllib.parse import urljoin, urlparse, quote
from bs4 import BeautifulSoup
import uuid
import re

# --- App Initialization and Configuration ---
static_folder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
UPLOADS_FOLDER_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))

app = Flask(__name__, static_folder=static_folder_path)
app.config['SECRET_KEY'] = 'supersecretkey'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = os.path.join(os.path.dirname(__file__), '.flask_session')
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 86400

CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5001"])
Session(app)
bcrypt = Bcrypt(app)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'db', 'database.db'))

# --- Decorators ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Database Setup ---
def init_db():
    if not os.path.exists(UPLOADS_FOLDER_PATH):
        os.makedirs(UPLOADS_FOLDER_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        settings TEXT
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        filename TEXT NOT NULL,
        is_folder BOOLEAN NOT NULL,
        file_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (parent_id) REFERENCES files (id) ON DELETE CASCADE
    )''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- Auth API Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username, email, password = data.get('username'), data.get('email'), data.get('password')
    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    if conn.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email)).fetchone():
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 409

    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    default_settings = json.dumps({'theme': 'dark', 'wallpaper': 'default.jpg'})

    cursor = conn.cursor()
    cursor.execute('INSERT INTO users (username, email, password_hash, settings) VALUES (?, ?, ?, ?)',
                   (username, email, password_hash, default_settings))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Create user's upload directory
    os.makedirs(os.path.join(UPLOADS_FOLDER_PATH, str(user_id)), exist_ok=True)

    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username, password = data.get('username'), data.get('password')
    if not all([username, password]):
        return jsonify({'error': 'Missing username or password'}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()

    if user and bcrypt.check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Login successful', 'username': user['username']}), 200

    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/check_session')
def check_session():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session.get('username')}), 200
    return jsonify({'logged_in': False}), 401

# --- File Manager API Routes ---
@app.route('/api/files', methods=['GET'])
@login_required
def list_files():
    user_id = session['user_id']
    parent_id = request.args.get('parent_id')

    query = 'SELECT id, filename, is_folder, created_at FROM files WHERE user_id = ? AND '
    params = [user_id]

    if parent_id in (None, 'null', 'undefined'):
        query += 'parent_id IS NULL'
    else:
        query += 'parent_id = ?'
        params.append(int(parent_id))

    query += ' ORDER BY is_folder DESC, filename ASC'

    conn = get_db_connection()
    files = conn.execute(query, tuple(params)).fetchall()
    conn.close()

    return jsonify([dict(row) for row in files])

@app.route('/api/files/folder', methods=['POST'])
@login_required
def create_folder():
    user_id = session['user_id']
    data = request.get_json()
    filename = data.get('filename')
    parent_id = data.get('parent_id')
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400

    conn = get_db_connection()
    conn.execute(
        'INSERT INTO files (user_id, parent_id, filename, is_folder) VALUES (?, ?, ?, ?)',
        (user_id, parent_id, filename, True)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Folder created successfully'}), 201

@app.route('/api/files/upload', methods=['POST'])
@login_required
def upload_file():
    user_id = session['user_id']
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    parent_id = request.form.get('parent_id')
    filename = secure_filename(file.filename)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO files (user_id, parent_id, filename, is_folder, file_path) VALUES (?, ?, ?, ?, ?)',
        (user_id, parent_id, filename, False, 'placeholder')
    )
    file_id = cursor.lastrowid

    file_path = os.path.join(UPLOADS_FOLDER_PATH, str(user_id), str(file_id))
    file.save(file_path)

    cursor.execute('UPDATE files SET file_path = ? WHERE id = ?', (file_path, file_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'File uploaded successfully'}), 201

@app.route('/api/files/download/<int:file_id>', methods=['GET'])
@login_required
def download_file(file_id):
    user_id = session['user_id']
    conn = get_db_connection()
    file_info = conn.execute('SELECT * FROM files WHERE id = ? AND user_id = ?', (file_id, user_id)).fetchone()
    conn.close()

    if not file_info or file_info['is_folder']:
        return jsonify({'error': 'File not found or is a folder'}), 404

    return send_file(file_info['file_path'], as_attachment=True, download_name=file_info['filename'])

@app.route('/api/files/rename/<int:file_id>', methods=['PUT'])
@login_required
def rename_file(file_id):
    user_id = session['user_id']
    new_name = request.json.get('new_name')
    if not new_name:
        return jsonify({'error': 'New name is required'}), 400

    conn = get_db_connection()
    conn.execute('UPDATE files SET filename = ? WHERE id = ? AND user_id = ?', (new_name, file_id, user_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'File renamed successfully'})

@app.route('/api/files/delete/<int:file_id>', methods=['DELETE'])
@login_required
def delete_file(file_id):
    user_id = session['user_id']
    conn = get_db_connection()

    # Recursively find all files to delete from filesystem
    files_to_delete = []
    q = [file_id]
    while q:
        current_id = q.pop(0)
        item = conn.execute('SELECT * FROM files WHERE id = ? AND user_id = ?', (current_id, user_id)).fetchone()
        if not item: continue # Should not happen if DB is consistent
        if not item['is_folder'] and item['file_path']:
            files_to_delete.append(item['file_path'])

        children = conn.execute('SELECT id FROM files WHERE parent_id = ?', (current_id,)).fetchall()
        for child in children:
            q.append(child['id'])

    # Delete physical files
    for path in files_to_delete:
        if os.path.exists(path):
            os.remove(path)

    # Delete from DB (CASCADE should handle children)
    conn.execute('DELETE FROM files WHERE id = ? AND user_id = ?', (file_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'File or folder deleted successfully'})

@app.route('/api/files/content/<int:file_id>', methods=['GET'])
@login_required
def get_file_content(file_id):
    user_id = session['user_id']
    conn = get_db_connection()
    file_info = conn.execute('SELECT * FROM files WHERE id = ? AND user_id = ?', (file_id, user_id)).fetchone()
    conn.close()

    if not file_info or file_info['is_folder']:
        return jsonify({'error': 'File not found or is a folder'}), 404

    try:
        with open(file_info['file_path'], 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': f'Could not read file: {e}'}), 500

@app.route('/api/files/content/<int:file_id>', methods=['PUT'])
@login_required
def update_file_content(file_id):
    user_id = session['user_id']
    conn = get_db_connection()
    file_info = conn.execute('SELECT * FROM files WHERE id = ? AND user_id = ?', (file_id, user_id)).fetchone()
    conn.close()

    if not file_info or file_info['is_folder']:
        return jsonify({'error': 'File not found or is a folder'}), 404

    data = request.get_json()
    if 'content' not in data:
        return jsonify({'error': 'No content provided'}), 400

    try:
        with open(file_info['file_path'], 'w', encoding='utf-8') as f:
            f.write(data['content'])
        return jsonify({'message': 'File saved successfully'})
    except Exception as e:
        return jsonify({'error': f'Could not write to file: {e}'}), 500

# --- Terminal API Route ---
def resolve_path(conn, user_id, cwd_id, path):
    """Resolves a path string (like '..', 'folder', '/a/b') to a file ID."""
    if path.startswith('/'):
        # Absolute path - not implemented for simplicity
        return None # Or resolve from root

    path_parts = path.split('/')
    current_id = cwd_id

    for part in path_parts:
        if not part or part == '.':
            continue
        if part == '..':
            if current_id is not None:
                # Get parent of current_id
                parent = conn.execute('SELECT parent_id FROM files WHERE id = ?', (current_id,)).fetchone()
                current_id = parent['parent_id'] if parent else None
            continue # Stay at root if already there

        # Look for the next part in the current directory
        query = 'SELECT id FROM files WHERE user_id = ? AND filename = ? AND is_folder = 1 AND '
        params = [user_id, part]
        if current_id is None:
            query += 'parent_id IS NULL'
        else:
            query += 'parent_id = ?'
            params.append(current_id)

        next_item = conn.execute(query, tuple(params)).fetchone()
        if next_item:
            current_id = next_item['id']
        else:
            return 'not_found' # Path does not exist

    return current_id

@app.route('/api/terminal/execute', methods=['POST'])
@login_required
def execute_command():
    user_id = session['user_id']
    data = request.get_json()
    command_str = data.get('command', '')
    cwd_id = data.get('cwd_id') # Current working directory ID

    parts = command_str.strip().split()
    command = parts[0].lower() if parts else ''
    args = parts[1:]

    output = ''
    new_cwd = {} # To send back if 'cd' is successful

    conn = get_db_connection()

    if command == 'help':
        output = 'Available commands: help, ls, cd, cat, echo'
    elif command == 'echo':
        output = ' '.join(args)
    elif command == 'ls':
        query = 'SELECT filename, is_folder FROM files WHERE user_id = ? AND '
        params = [user_id]
        if cwd_id is None:
            query += 'parent_id IS NULL'
        else:
            query += 'parent_id = ?'
            params.append(cwd_id)
        query += ' ORDER BY is_folder DESC, filename ASC'

        items = conn.execute(query, tuple(params)).fetchall()
        output = '\n'.join([f"{i['filename']}{'/' if i['is_folder'] else ''}" for i in items])
    elif command == 'cd':
        if not args:
            output = 'Usage: cd <directory>'
        else:
            path = args[0]
            target_id = resolve_path(conn, user_id, cwd_id, path)

            if target_id == 'not_found':
                output = f"cd: no such file or directory: {path}"
            else:
                # Get the name of the new directory for the prompt
                if target_id is None:
                    new_cwd = {'id': None, 'name': '~'}
                else:
                    new_name = conn.execute('SELECT filename FROM files WHERE id = ?', (target_id,)).fetchone()['filename']
                    new_cwd = {'id': target_id, 'name': new_name}
                output = f"Changed directory to {new_cwd['name']}"
    elif command == 'cat':
        if not args:
            output = 'Usage: cat <path/to/filename>'
        else:
            path = args[0]
            target_dir_id = cwd_id
            filename = path

            if '/' in path:
                path_parts = path.rsplit('/', 1)
                dir_path, filename = path_parts[0], path_parts[1]
                if dir_path: # Handle cases like 'folder/file.txt' but not '/file.txt' from root
                    target_dir_id = resolve_path(conn, user_id, cwd_id, dir_path)
                else: # Path starts with '/', treat as absolute from user's root
                    target_dir_id = None

            if target_dir_id == 'not_found':
                output = f"cat: {path}: No such file or directory"
            else:
                query = 'SELECT id, file_path, is_folder FROM files WHERE user_id = ? AND filename = ? AND '
                params = [user_id, filename]
                if target_dir_id is None:
                    query += 'parent_id IS NULL'
                else:
                    query += 'parent_id = ?'
                    params.append(target_dir_id)

                file_to_cat = conn.execute(query, tuple(params)).fetchone()

                if not file_to_cat:
                    output = f"cat: {path}: No such file or directory"
                elif file_to_cat['is_folder']:
                    output = f"cat: {filename}: Is a directory"
                else:
                    try:
                        with open(file_to_cat['file_path'], 'r', encoding='utf-8') as f:
                            output = f.read()
                    except Exception:
                        output = f"cat: {filename}: Cannot read file"
    else:
        output = f'{command}: command not found'

    conn.close()
    return jsonify({'output': output, 'new_cwd': new_cwd})

# --- Settings API Routes ---
@app.route('/api/settings', methods=['GET'])
@login_required
def get_settings():
    user_id = session['user_id']
    conn = get_db_connection()
    settings_json = conn.execute('SELECT settings FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    if settings_json and settings_json['settings']:
        return jsonify(json.loads(settings_json['settings']))
    return jsonify({})

@app.route('/api/settings', methods=['PUT'])
@login_required
def update_settings():
    user_id = session['user_id']
    new_settings = request.get_json()

    conn = get_db_connection()

    # Get current settings
    user = conn.execute('SELECT settings FROM users WHERE id = ?', (user_id,)).fetchone()
    current_settings = json.loads(user['settings']) if user and user['settings'] else {}

    # Merge new settings into current settings
    current_settings.update(new_settings)

    # Save merged settings
    conn.execute('UPDATE users SET settings = ? WHERE id = ?', (json.dumps(current_settings), user_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Settings updated successfully'})


# --- Browser API Routes ---
browser_sessions = {}
playwright = None
loop = None

def run_event_loop(new_loop):
    asyncio.set_event_loop(new_loop)
    new_loop.run_forever()

def start_event_loop_thread():
    global loop
    loop = asyncio.new_event_loop()
    t = threading.Thread(target=run_event_loop, args=(loop,))
    t.daemon = True
    t.start()

async def launch_playwright():
    global playwright
    playwright = await async_playwright().start()

def start_playwright():
    future = asyncio.run_coroutine_threadsafe(launch_playwright(), loop)
    future.result()

@app.route('/api/browser', methods=['POST'])
@login_required
def browser_new_session():
    user_id = session['user_id']
    session_id = str(user_id)

    if session_id in browser_sessions:
        # If session exists, just return the existing info
        first_page_id = next(iter(browser_sessions[session_id]['pages']))
        return jsonify({'session_id': session_id, 'page_id': first_page_id, 'message': 'Session already exists.'})

    async def _create_session():
        browser = await playwright.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        page_id = str(uuid.uuid4())
        browser_sessions[session_id] = {
            'browser': browser,
            'context': context,
            'pages': {page_id: page}
        }
        return page_id

    future = asyncio.run_coroutine_threadsafe(_create_session(), loop)
    page_id = future.result()
    return jsonify({'session_id': session_id, 'page_id': page_id})

@app.route('/api/browser/<session_id>', methods=['DELETE'])
@login_required
def browser_close_session(session_id):
    if session_id in browser_sessions:
        async def _close_session():
            session_data = browser_sessions.pop(session_id)
            await session_data['browser'].close() # Closing the browser closes all contexts and pages

        future = asyncio.run_coroutine_threadsafe(_close_session(), loop)
        future.result()
        return jsonify({'message': 'Browser session closed'})
    return jsonify({'error': 'Session not found'}), 404

@app.route('/api/browser/<session_id>/pages', methods=['POST'])
@login_required
def browser_new_page(session_id):
    if session_id not in browser_sessions:
        return jsonify({'error': 'Session not found'}), 404

    async def _create_page():
        context = browser_sessions[session_id]['context']
        page = await context.new_page()
        page_id = str(uuid.uuid4())
        browser_sessions[session_id]['pages'][page_id] = page
        return page_id

    future = asyncio.run_coroutine_threadsafe(_create_page(), loop)
    page_id = future.result()
    return jsonify({'page_id': page_id})

@app.route('/api/browser/<session_id>/pages/<page_id>', methods=['DELETE'])
@login_required
def browser_close_page(session_id, page_id):
    if session_id not in browser_sessions or page_id not in browser_sessions[session_id]['pages']:
        return jsonify({'error': 'Session or page not found'}), 404

    async def _close_page():
        page = browser_sessions[session_id]['pages'].pop(page_id)
        await page.close()

    future = asyncio.run_coroutine_threadsafe(_close_page(), loop)
    future.result()

    # Optional: close the entire browser if the last tab is closed
    if not browser_sessions[session_id]['pages']:
        return browser_close_session(session_id)

    return jsonify({'message': 'Page closed'})

@app.route('/api/browser/<session_id>/pages/<page_id>/navigate', methods=['POST'])
@login_required
def browser_navigate(session_id, page_id):
    url = request.json.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    if not url.startswith(('http://', 'https://')):
        url = 'http://' + url

    if session_id in browser_sessions and page_id in browser_sessions[session_id]['pages']:
        page = browser_sessions[session_id]['pages'][page_id]
        async def _navigate():
            try:
                await page.goto(url, wait_until='domcontentloaded', timeout=60000)
                final_url = page.url
                return {'message': f'Navigated to {url}', 'final_url': final_url}
            except Exception as e:
                return {'error': f'Navigation failed: {e}'}

        future = asyncio.run_coroutine_threadsafe(_navigate(), loop)
        result = future.result()
        return jsonify(result)
    return jsonify({'error': 'Session or page not found'}), 404

@app.route('/api/browser/<session_id>/pages/<page_id>/proxy')
@login_required
def proxy_resource(session_id, page_id):
    url = request.args.get('url')
    if not url:
        return "URL is required", 400

    if not url.startswith(('http://', 'https://')):
        return "Invalid URL scheme", 400

    try:
        proxied_response = requests.get(url, stream=True, timeout=20, headers={'Referer': url})
        proxied_response.raise_for_status()

        def generate():
            for chunk in proxied_response.iter_content(chunk_size=8192):
                yield chunk

        headers = {
            'Content-Type': proxied_response.headers.get('Content-Type', 'application/octet-stream'),
            'Content-Length': proxied_response.headers.get('Content-Length'),
            'Cache-Control': 'public, max-age=86400'
        }
        headers = {k: v for k, v in headers.items() if v is not None}

        return Response(generate(), status=proxied_response.status_code, headers=headers)
    except requests.exceptions.RequestException as e:
        print(f"Error proxying {url}: {e}")
        return "Failed to proxy resource", 502

@app.route('/api/browser/<session_id>/pages/<page_id>/view')
@login_required
def browser_view(session_id, page_id):
    if session_id not in browser_sessions or page_id not in browser_sessions[session_id]['pages']:
        return "Session or page not found.", 404

    page = browser_sessions[session_id]['pages'][page_id]

    async def _get_content():
        try:
            content = await page.content()
            current_url = page.url
            return {'content': content, 'url': current_url}
        except Exception as e:
            return {'error': str(e)}

    future = asyncio.run_coroutine_threadsafe(_get_content(), loop)
    result = future.result()

    if 'error' in result:
        return f"Failed to get page content: {result['error']}", 500

    content = result['content']
    base_url = result['url']
    soup = BeautifulSoup(content, 'lxml')

    base_tag = soup.new_tag('base', href=base_url)
    post_message_script = soup.new_tag('script')
    post_message_script.string = f"""
        window.addEventListener('load', () => {{
            if (window.parent && window.parent !== window) {{
                window.parent.postMessage({{
                    type: 'browser-url-change',
                    url: '{base_url}',
                    sessionId: '{session_id}',
                    pageId: '{page_id}'
                }}, '*');
            }}
        }});
    """

    if soup.head:
        soup.head.insert(0, base_tag)
        soup.head.append(post_message_script)
    else:
        head = soup.new_tag('head')
        soup.insert(0, head)
        head.append(base_tag)
        head.append(post_message_script)

    def proxy_css_urls(css_text):
        def replacer(m):
            original_url = m.group(1).strip('\'"')
            if original_url.startswith('data:'):
                return f"url('{original_url}')"
            absolute_url = urljoin(base_url, original_url)
            proxied_url = f"/api/browser/{session_id}/pages/{page_id}/proxy?url={quote(absolute_url)}"
            return f"url('{proxied_url}')"
        return re.sub(r'url\((.*?)\)', replacer, css_text)

    for tag in soup.find_all(style=True):
        tag['style'] = proxy_css_urls(tag['style'])

    for style_tag in soup.find_all('style'):
        if style_tag.string:
            style_tag.string.replace_with(proxy_css_urls(style_tag.string))

    tags_to_rewrite = {
        'a': ['href'], 'link': ['href'], 'img': ['src', 'srcset'],
        'script': ['src'], 'audio': ['src'], 'video': ['src', 'poster'],
        'source': ['src', 'srcset'], 'embed': ['src'], 'iframe': ['src'],
        'object': ['data'], 'track': ['src'],
    }

    for tag_name, attrs in tags_to_rewrite.items():
        for tag in soup.find_all(tag_name):
            for attr in attrs:
                if not tag.has_attr(attr): continue

                val = tag[attr]
                if not val or val.startswith('data:') or val.startswith('javascript:'): continue
                if val.startswith('#'): continue

                if attr != 'srcset':
                    absolute_url = urljoin(base_url, val)
                    if tag_name == 'a' or (tag_name == 'link' and tag.get('rel') != ['stylesheet']):
                        tag[attr] = f"/api/browser/{session_id}/pages/{page_id}/navigate_and_view?url={quote(absolute_url)}"
                    else:
                        tag[attr] = f"/api/browser/{session_id}/pages/{page_id}/proxy?url={quote(absolute_url)}"
                else:
                    new_srcset = []
                    for part in val.split(','):
                        part = part.strip()
                        if not part: continue
                        url_part, *descriptor_part = part.split(maxsplit=1)
                        descriptor = descriptor_part[0] if descriptor_part else ''
                        absolute_url = urljoin(base_url, url_part)
                        proxied_url = f"/api/browser/{session_id}/pages/{page_id}/proxy?url={quote(absolute_url)}"
                        new_srcset.append(f"{proxied_url} {descriptor}")
                    tag[attr] = ", ".join(new_srcset)

    for form in soup.find_all('form', action=True):
        action = form['action']
        absolute_url = urljoin(base_url, action)
        form['action'] = f"/api/browser/{session_id}/pages/{page_id}/navigate_and_view?url={quote(absolute_url)}"

    return str(soup), 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/api/browser/<session_id>/pages/<page_id>/navigate_and_view')
@login_required
def browser_navigate_and_view(session_id, page_id):
    url = request.args.get('url')
    if not url:
        return "URL is required", 400

    if session_id not in browser_sessions or page_id not in browser_sessions[session_id]['pages']:
        return "Session or page not found", 404

    page = browser_sessions[session_id]['pages'][page_id]

    async def _navigate():
        try:
            await page.goto(url, wait_until='domcontentloaded')
        except Exception as e:
            print(f"Navigation failed in navigate_and_view: {e}")

    future = asyncio.run_coroutine_threadsafe(_navigate(), loop)
    future.result()

    return browser_view(session_id, page_id)


@app.route('/api/files/new_text_file', methods=['POST'])
@login_required
def new_text_file():
    user_id = session['user_id']
    data = request.get_json()
    parent_id = data.get('parent_id')
    filename = data.get('filename') # Can be None

    conn = get_db_connection()

    if not filename:
        # Find a unique filename if not provided
        base_name = "Untitled"
        extension = ".txt"
        filename = f"{base_name}{extension}"
        counter = 1

        # Build query to check for existing file
        query = 'SELECT 1 FROM files WHERE user_id = ? AND filename = ? AND '
        params = [user_id, filename]
        if parent_id is None:
            query += 'parent_id IS NULL'
        else:
            query += 'parent_id = ?'
            params.append(parent_id)

        while conn.execute(query, tuple(params)).fetchone():
            filename = f"{base_name} ({counter}){extension}"
            params[1] = filename # Update filename in params
            counter += 1

    # Create the empty physical file and the DB record
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO files (user_id, parent_id, filename, is_folder, file_path) VALUES (?, ?, ?, ?, ?)',
        (user_id, parent_id, filename, False, 'placeholder')
    )
    file_id = cursor.lastrowid

    file_path = os.path.join(UPLOADS_FOLDER_PATH, str(user_id), str(file_id))
    with open(file_path, 'w') as f:
        pass # Create empty file

    cursor.execute('UPDATE files SET file_path = ? WHERE id = ?', (file_path, file_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'File created successfully', 'id': file_id, 'filename': filename}), 201

# --- Static File Serving ---
@app.route('/')
def index():
    if 'user_id' in session:
        return send_from_directory(app.static_folder, 'index.html')
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

import atexit

def shutdown_playwright():
    if playwright:
        async def _shutdown():
            await playwright.stop()

        future = asyncio.run_coroutine_threadsafe(_shutdown(), loop)
        future.result()

if __name__ == '__main__':
    init_db()
    start_event_loop_thread()
    start_playwright()
    atexit.register(shutdown_playwright)
    app.run(debug=True, port=5001)
