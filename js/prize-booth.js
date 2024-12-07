import { db, auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ticketForm = document.getElementById('ticketForm');
const messageDiv = document.getElementById('message');
const logoutBtn = document.getElementById('logoutBtn');
const loadingText = document.querySelector('.loading-text');
const ticketNumberInput = document.getElementById('ticketNumber');
const submitButton = ticketForm.querySelector('button[type="submit"]');

// Function to pad ticket number to 5 digits
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    loadingText.classList.toggle('visible', isLoading);
    submitButton.disabled = isLoading;
    ticketNumberInput.disabled = isLoading;
    
    // Focus the input when loading is done
    if (!isLoading) {
        setTimeout(() => ticketNumberInput.focus(), 0);
    }
}

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

// Handle ticket number submission
ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ticketNumber = ticketNumberInput.value;
    
    // Validate that input is a number
    if (!/^\d+$/.test(ticketNumber)) {
        showMessage('Please enter a valid number', 'error');
        return;
    }

    // Show loading state
    setLoading(true);

    // Pad the ticket number to 5 digits
    ticketNumber = padTicketNumber(ticketNumber);

    try {
        const ticketRef = doc(db, 'tickets', ticketNumber);
        const ticketSnap = await getDoc(ticketRef);

        if (!ticketSnap.exists()) {
            showMessage('Ticket not found!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }

        const ticketData = ticketSnap.data();
        
        // Check specific ticket states and show appropriate messages
        if (ticketData.status !== 'Released') {
            showMessage('Invalid ticket!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }
        
        if (ticketData.state !== 'Used') {
            showMessage('Ticket has not been used in a game yet!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }
        
        if (ticketData.claim === 'Claimed') {
            showMessage('Prize already claimed for this ticket!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }

        await updateDoc(ticketRef, {
            claim: 'Claimed',
            claimedAt: serverTimestamp()
        });

        showMessage('Prize claimed successfully!', 'success');
        ticketNumberInput.value = '';
        ticketNumberInput.focus();
    } catch (error) {
        showMessage('Error processing ticket: ' + error.message, 'error');
    } finally {
        // Hide loading state
        setLoading(false);
    }
});

// Add input event listener to format the ticket number as user types
ticketNumberInput.addEventListener('input', function(e) {
    // Remove any non-digit characters
    let value = this.value.replace(/\D/g, '');
    
    // Update the input value with the cleaned number
    this.value = value;
});

function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
} 