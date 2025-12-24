const API_URL = '/api';

async function login(username, password) {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Login failed');
    }
}

async function register(username, password) {
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            window.location.href = 'index.html';
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Registration failed');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return null;
    }
    return JSON.parse(localStorage.getItem('user'));
}
