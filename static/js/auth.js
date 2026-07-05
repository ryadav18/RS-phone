// AUTHENTICATION INTERACTION SYSTEM LOGIC
class AuthenticationEngine {
    constructor() {
        this.apiBase = '/api/auth';
        this.initializeFormListeners();
    }

    initializeFormListeners() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }
    }

    async handleLogin(event) {
        event.preventDefault(); // Yeh page ko refresh hone se rokta hai
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = event.submitter;

        btn.disabled = true;
        btn.textContent = 'Authenticating...';

        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();
            if (result.status === 'success') {
                localStorage.setItem('owner_token', result.token);
                localStorage.setItem('owner_data', JSON.stringify(result.user));
                window.location.href = '/dashboard';
            } else {
                alert(result.message || 'Validation failed');
                btn.disabled = false;
                btn.textContent = 'LOG IN';
            }
        } catch (error) {
            console.error('Network execution failure:', error);
            btn.disabled = false;
            btn.textContent = 'LOG IN';
        }
    }

    async handleRegistration(event) {
        event.preventDefault(); // Yeh page ko refresh hone se rokta hai
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const btn = event.submitter;

        btn.disabled = true;
        btn.textContent = 'Processing Registration...';

        try {
            const response = await fetch(`${this.apiBase}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const result = await response.json();
            if (result.status === 'success') {
                alert('Account verified successfully! Directing to standard login context');
                // Form clear karke page ko wapas login state mein laane ke liye reload
                window.location.href = '/'; 
            } else {
                alert(result.message || 'Registration issue');
                btn.disabled = false;
                btn.textContent = 'REGISTER NEW ACCOUNT';
            }
        } catch (error) {
            console.error('Execution failure during signup processing:', error);
            btn.disabled = false;
            btn.textContent = 'REGISTER NEW ACCOUNT';
        }
    }

    static checkAuth() {
        const token = localStorage.getItem('owner_token');
        if (!token && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    }

    static async performSignOut() {
        const token = localStorage.getItem('owner_token');
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error(e);
        }
        localStorage.clear();
        window.location.href = '/';
    }
}

// Global initialization logic block
document.addEventListener('DOMContentLoaded', () => {
    AuthenticationEngine.checkAuth();
    
    // YEH MASTER SWITCH HAI - Iske bina forms backend se connect nahi hote
    new AuthenticationEngine(); 
});
