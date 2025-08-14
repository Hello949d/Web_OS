# WebOS - A Fully Functional Web-Based Operating System

This project is a browser-based Operating System (WebOS) with a complete desktop environment, user authentication, a hierarchical file system, and several core applications. It is built with a Flask backend and a vanilla JavaScript frontend styled with Tailwind CSS.

## Features

*   **Persistent Multi-User System:**
    *   User registration and login system with bcrypt-hashed passwords.
    *   Each user has their own private file system, settings, and desktop environment.
    *   Session management to keep users logged in.
*   **Complete Desktop UI:**
    *   A familiar desktop interface with app icons.
    *   A taskbar with a Start Menu and a live clock.
    *   A from-scratch windowing system supporting draggable, resizable, and focus-aware windows.
*   **Core Applications:**
    *   **File Manager:** Browse the file hierarchy, create folders, upload/download files, and rename/delete items via a context menu.
    *   **Text Editor:** Open, edit, and save text-based files (`.txt`, `.md`, `.json`, etc.).
    *   **Image Viewer:** View common image formats (`.png`, `.jpg`, `.gif`, etc.).
    *   **Terminal:** A command-line interface with support for `ls`, `cd`, `cat`, `echo`, and `help`.
    *   **Settings:** Change user-specific settings, such as the desktop wallpaper.
*   **Notification System:** Non-intrusive pop-up notifications for actions like "File Saved" or "Upload Complete".

## Project Structure

```
/
|-- backend/
|   |-- app.py             # Main Flask application, API endpoints
|-- frontend/
|   |-- js/                # All frontend JavaScript files for apps
|   |-- index.html         # Main desktop page
|   |-- login.html         # Login page
|   |-- register.html      # Registration page
|-- assets/
|   |-- wallpapers/        # Default wallpaper
|-- db/
|   |-- database.db        # SQLite database file (created on run)
|-- uploads/
|   |-- <user_id>/         # User-specific file storage (created on run)
|-- requirements.txt       # Python dependencies
|-- README.md              # This file
```

## Setup and Installation

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd Web_OS
    ```

2.  **Install Dependencies**
    Ensure you have Python 3 and pip installed.
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the Application**
    ```bash
    python3 backend/app.py
    ```
    The server will start on `http://127.0.0.1:5001`.

4.  **Access the WebOS**
    Open your browser and navigate to [http://127.0.0.1:5001](http://127.0.0.1:5001).

## How to Use

*   You will be greeted by the login page.
*   Register a new user account or use the test credentials below.
*   Once logged in, you will see the desktop.
*   Double-click icons to open applications.
*   Drag window title bars to move them.
*   Drag window corners and edges to resize them.
*   Right-click on files in the File Manager to access more options.

## Default Test Credentials

For quick testing, you can use the following credentials. The first time you run the application, you will need to register this user.

*   **Username:** `testuser`
*   **Password:** `password`

---
*This project was built by Jules, an AI software engineer.*
