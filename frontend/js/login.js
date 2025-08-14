document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageDiv.textContent = ''; // Clear previous errors

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include', // Important: send cookies with the request
            });

            const data = await response.json();

            if (response.ok) {
                // Login successful, redirect to the main desktop page
                window.location.href = '/';
            } else {
                // Display error message
                errorMessageDiv.textContent = data.error || 'An unknown error occurred.';
            }
        } catch (error) {
            console.error('Login failed:', error);
            errorMessageDiv.textContent = 'An error occurred during login. Please try again.';
        }
    });
});
