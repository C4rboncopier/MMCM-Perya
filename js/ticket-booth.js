import { db, auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const quantityForm = document.getElementById('quantityForm');
const ticketForm = document.getElementById('ticketForm');
const messageDiv = document.getElementById('message');
const logoutBtn = document.getElementById('logoutBtn');
const currentTicketSpan = document.getElementById('currentTicket');
const totalTicketsSpan = document.getElementById('totalTickets');
const cancelBtn = document.getElementById('cancelBtn');
const loadingText = document.querySelector('.loading-text');
const releaseButton = ticketForm.querySelector('button[type="submit"]');
const ticketNumberInput = document.getElementById('ticketNumber');

let currentTicketCount = 1;
let totalTickets = 0;
let hasReleasedTickets = false;

// Function to pad ticket number to 5 digits
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    loadingText.classList.toggle('visible', isLoading);
    releaseButton.disabled = isLoading;
    cancelBtn.disabled = isLoading || hasReleasedTickets;
    ticketNumberInput.disabled = isLoading;
    
    // If we're done loading and there are still tickets to process, focus the input
    if (!isLoading && currentTicketCount <= totalTickets) {
        setTimeout(() => ticketNumberInput.focus(), 0);
    }
}

// Function to reset the ticket form state
function resetTicketForm() {
    ticketForm.style.display = 'none';
    quantityForm.style.display = 'block';
    quantityForm.reset();
    currentTicketCount = 1;
    totalTickets = 0;
    hasReleasedTickets = false;
    cancelBtn.disabled = false;
    setLoading(false);
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

// Handle cancel button
cancelBtn.addEventListener('click', () => {
    if (!hasReleasedTickets) {
        resetTicketForm();
        showMessage('Ticket release cancelled', 'success');
    }
});

// Handle ticket quantity submission
quantityForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const quantity = parseInt(document.getElementById('ticketQuantity').value);
    
    if (quantity < 1) {
        showMessage('Please enter a valid quantity', 'error');
        return;
    }

    // Update the counter and show the ticket form
    currentTicketCount = 1;
    totalTickets = quantity;
    totalTicketsSpan.textContent = quantity;
    currentTicketSpan.textContent = currentTicketCount;
    
    // Reset ticket release state
    hasReleasedTickets = false;
    cancelBtn.disabled = false;
    
    // Hide quantity form and show ticket form
    quantityForm.style.display = 'none';
    ticketForm.style.display = 'block';
    
    // Focus on the ticket number input
    setTimeout(() => ticketNumberInput.focus(), 0);
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

        if (ticketSnap.exists()) {
            showMessage('This ticket number already exists!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }

        await setDoc(ticketRef, {
            status: 'Released',
            state: 'Unused',
            claim: 'Unclaimed',
            createdAt: serverTimestamp(),
            ticketNumber: ticketNumber // Store the padded ticket number
        });

        // Mark that we've released at least one ticket and disable cancel
        hasReleasedTickets = true;
        cancelBtn.disabled = true;

        showMessage('Ticket released successfully!', 'success');
        
        // Clear the ticket number input
        ticketNumberInput.value = '';
        
        // Update counter or reset forms if done
        if (currentTicketCount < totalTickets) {
            currentTicketCount++;
            currentTicketSpan.textContent = currentTicketCount;
            setTimeout(() => ticketNumberInput.focus(), 0);
        } else {
            // Reset everything for a new batch
            resetTicketForm();
            showMessage('All tickets have been released successfully!', 'success');
        }
    } catch (error) {
        showMessage('Error releasing ticket: ' + error.message, 'error');
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