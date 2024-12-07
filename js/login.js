import { auth, db, initializeFirebase } from './firebase-config.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

// Booth credentials mapping
const boothCredentials = {
    'ticket-booth': {
        username: 'ticketbooth',
        redirect: '../pages/ticket-booth.html'
    },
    'game-booth': {
        username: 'gamebooth',
        redirect: '../pages/game-booth.html'
    },
    'prize-booth': {
        username: 'prizebooth',
        redirect: '../pages/prize-booth.html'
    }
};

// Initialize Firebase and set up auth state listener
async function initializeAuth() {
    const { auth } = await initializeFirebase();
    
    // Check if already logged in and has valid booth type
    auth.onAuthStateChanged((user) => {
        if (user && window.location.pathname.includes('login.html')) {
            const boothType = localStorage.getItem('boothType');
            if (boothType && boothCredentials[boothType]) {
                window.location.href = boothCredentials[boothType].redirect;
            }
        }
    });
}

// Initialize authentication
initializeAuth();

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        // Find the booth type based on username
        const boothType = Object.keys(boothCredentials).find(
            key => boothCredentials[key].username === username
        );

        if (!boothType) {
            showMessage('Invalid username or password', 'error');
            return;
        }

        // Convert username to email format for Firebase Authentication
        const email = `${username}@mmcmcarnival.com`;
        
        // Get initialized auth instance
        const { auth } = await initializeFirebase();
        
        // Attempt to sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // If successful, redirect to appropriate booth page
        if (userCredential.user) {
            localStorage.setItem('boothType', boothType);
            window.location.href = boothCredentials[boothType].redirect;
        }

    } catch (error) {
        showMessage('Invalid username or password', 'error');
        console.error(error);
    }
});

function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
} 