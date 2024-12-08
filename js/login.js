import { auth, db, initializeFirebase } from './firebase-config.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

// Booth credentials mapping
const boothCredentials = {
    'ticket-booth': {
        username: 'ticketbooth',
        redirect: '../pages/ticket-booth.html'
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
            if (boothType) {
                if (boothType === 'game-booth') {
                    window.location.href = '../pages/game-booth.html';
                } else if (boothCredentials[boothType]) {
                    window.location.href = boothCredentials[boothType].redirect;
                }
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
        // Check if it's a fixed booth type
        const boothType = Object.keys(boothCredentials).find(
            key => boothCredentials[key].username === username
        );

        // Convert username to email format for Firebase Authentication
        const email = `${username}@mmcmcarnival.com`;
        
        // Get initialized auth instance
        const { auth } = await initializeFirebase();
        
        // Attempt to sign in
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // If successful, determine booth type and redirect
        if (userCredential.user) {
            if (boothType) {
                localStorage.setItem('boothType', boothType);
                window.location.href = boothCredentials[boothType].redirect;
            } else {
                // For game booth accounts
                // Check if game booth exists in Firestore, create if it doesn't
                const boothRef = doc(db, 'gameBooths', username);
                const boothSnap = await getDoc(boothRef);
                
                if (!boothSnap.exists()) {
                    // Create new game booth document
                    await setDoc(boothRef, {
                        username: username,
                        email: email,
                        totalTickets: 0,
                        createdAt: serverTimestamp(),
                        lastUpdated: serverTimestamp()
                    });
                }

                localStorage.setItem('boothType', 'game-booth');
                localStorage.setItem('gameName', username);
                window.location.href = '../pages/game-booth.html';
            }
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