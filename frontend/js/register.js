document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const errorMessageDiv = document.getElementById('error-message');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessageDiv.textContent = ''; // Clear previous errors

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Registration successful, redirect to login page
                window.location.href = '/login.html';
            } else {
                // Display error message
                errorMessageDiv.textContent = data.error || 'An unknown error occurred.';
            }
        } catch (error) {
            console.error('Registration failed:', error);
            errorMessageDiv.textContent = 'An error occurred during registration. Please try again.';
        }
    });
});
