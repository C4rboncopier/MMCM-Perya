import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Function to redirect to login
function redirectToLogin() {
    // Don't redirect if we're already on the login page
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '../pages/login.html';
    }
}

// Function to check booth access
function checkBoothAccess(user) {
    // Skip all checks if we're on the login page
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    // If no user, redirect to login
    if (!user) {
        redirectToLogin();
        return;
    }

    const boothType = localStorage.getItem('boothType');
    if (!boothType) {
        auth.signOut().then(() => {
            localStorage.removeItem('boothType');
            redirectToLogin();
        });
        return;
    }

    // Only redirect if we're on the wrong booth page
    const currentPage = window.location.pathname;
    const boothUrls = {
        'ticket-booth': '/pages/ticket-booth.html',
        'game-booth': '/pages/game-booth.html',
        'prize-booth': '/pages/prize-booth.html'
    };

    // Check if we're on a booth page but it's the wrong one
    if (currentPage.includes('booth') && !currentPage.includes(boothType)) {
        window.location.href = boothUrls[boothType];
    }
}

// Wait for auth state to be ready before checking
onAuthStateChanged(auth, (user) => {
    checkBoothAccess(user);
}); 