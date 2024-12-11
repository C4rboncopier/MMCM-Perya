import { auth, initializeFirebase } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Function to redirect to login
function redirectToLogin() {
    // Don't redirect if we're already on the login page
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = '../pages/login.html';
    }
}

// Function to check booth access
async function checkBoothAccess(user) {
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
            localStorage.removeItem('gameName');
            redirectToLogin();
        });
        return;
    }

    // For game booth, check if game name exists
    if (boothType === 'game-booth' && !localStorage.getItem('gameName')) {
        auth.signOut().then(() => {
            localStorage.removeItem('boothType');
            localStorage.removeItem('gameName');
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

    // Special handling for bingo card page
    if (currentPage.includes('bingo-card.html')) {
        // Only ticket booth users can access the bingo card page
        if (boothType !== 'ticket-booth') {
            window.location.href = boothUrls[boothType];
            return;
        }
        // If it's a ticket booth user on the bingo page, allow access
        return;
    }

    // Check if we're on a booth page but it's the wrong one
    if (currentPage.includes('booth') && !currentPage.includes(boothType)) {
        window.location.href = boothUrls[boothType];
    }
}

// Initialize Firebase and set up auth state listener
async function initializeAuth() {
    const { auth } = await initializeFirebase();
    
    // Wait for auth state to be ready before checking
    onAuthStateChanged(auth, (user) => {
        checkBoothAccess(user);
    });
}

// Initialize authentication
initializeAuth(); 