import { db, auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ticketForm = document.getElementById('ticketForm');
const messageDiv = document.getElementById('message');
const logoutBtn = document.getElementById('logoutBtn');

// Add logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('boothType');
        window.location.href = '../pages/login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showMessage('Error signing out', 'error');
    }
});

ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ticketNumber = document.getElementById('ticketNumber').value;

    try {
        const ticketRef = doc(db, 'tickets', ticketNumber);
        const ticketSnap = await getDoc(ticketRef);

        if (ticketSnap.exists()) {
            showMessage('This ticket number already exists!', 'error');
            return;
        }

        await setDoc(ticketRef, {
            status: 'Released',
            state: 'Unused',
            claim: 'Unclaimed',
            createdAt: serverTimestamp()
        });

        showMessage('Ticket released successfully!', 'success');
        ticketForm.reset();
    } catch (error) {
        showMessage('Error releasing ticket: ' + error.message, 'error');
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