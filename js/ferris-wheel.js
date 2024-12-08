import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp, query, orderBy, limit, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize all DOM elements
let messageDiv, logoutBtn, manualTicketForm, backToNormalBtn, ticketList, highestTicketSpan;
let initializedDb;

// Function to initialize DOM elements
function initializeDOMElements() {
    messageDiv = document.getElementById('message');
    logoutBtn = document.getElementById('logoutBtn');
    manualTicketForm = document.getElementById('manualTicketForm');
    backToNormalBtn = document.getElementById('backToNormalBtn');
    ticketList = document.getElementById('ticketList');
    highestTicketSpan = document.getElementById('highestTicket');

    if (!messageDiv || !logoutBtn || !manualTicketForm || !backToNormalBtn || !ticketList || !highestTicketSpan) {
        throw new Error('Required DOM elements not found');
    }
}

// Function to show message
function showMessage(message, type) {
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
}

// Function to update ticket list
function updateTicketList(ticketNumber) {
    if (!ticketList) return;

    const ticketItem = document.createElement('div');
    ticketItem.className = 'ticket-item';
    ticketItem.textContent = `Ferris Wheel Ticket Number: ${ticketNumber}`;
    ticketList.insertBefore(ticketItem, ticketList.firstChild);

    // Keep only the last 5 tickets in the list
    while (ticketList.children.length > 5) {
        ticketList.removeChild(ticketList.lastChild);
    }
}

// Function to setup highest ticket listener
function setupHighestTicketListener() {
    if (!highestTicketSpan) return;

    const ferrisWheelTicketsRef = collection(db, 'ferrisWheelTickets');
    const q = query(ferrisWheelTicketsRef, orderBy('ticketNumber', 'desc'), limit(1));

    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const highestTicket = snapshot.docs[0].data().ticketNumber;
            highestTicketSpan.textContent = highestTicket;
        } else {
            highestTicketSpan.textContent = '0';
        }
    }, (error) => {
        console.error('Error getting highest ticket:', error);
        highestTicketSpan.textContent = 'Error';
    });
}

// Function to handle manual ticket submission
async function handleManualTicketSubmission(e) {
    e.preventDefault();
    let ticketNumber = document.getElementById('manualTicketNumber').value;

    // Convert to number and validate
    ticketNumber = Number(ticketNumber);
    if (isNaN(ticketNumber) || ticketNumber < 1) {
        showMessage('Please enter a valid positive number', 'error');
        return;
    }

    try {
        const ticketRef = doc(db, 'ferrisWheelTickets', ticketNumber.toString());
        const ticketSnap = await getDoc(ticketRef);

        if (ticketSnap.exists()) {
            showMessage(`Ticket number ${ticketNumber} already exists!`, 'error');
            return;
        }

        await setDoc(ticketRef, {
            status: 'Released',
            createdAt: serverTimestamp(),
            ticketNumber: ticketNumber.toString()
        });

        showMessage(`Ticket ${ticketNumber} added successfully!`, 'success');
        document.getElementById('manualTicketNumber').value = '';
        updateTicketList(ticketNumber);
    } catch (error) {
        showMessage(`Error adding ticket ${ticketNumber}: ${error.message}`, 'error');
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase first
        const { db: firebaseDb } = await initializeFirebase();
        initializedDb = firebaseDb;

        // Initialize DOM elements
        initializeDOMElements();

        // Setup real-time listener for highest ticket number
        const unsubscribe = setupHighestTicketListener();

        // Add event listeners
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    // Clean up listener before logging out
                    unsubscribe();
                    await signOut(auth);
                    localStorage.removeItem('boothType');
                    window.location.href = '../pages/login.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    showMessage('Error signing out', 'error');
                }
            });
        }

        if (backToNormalBtn) {
            backToNormalBtn.addEventListener('click', () => {
                window.location.href = 'ticket-booth.html';
            });
        }

        if (manualTicketForm) {
            manualTicketForm.addEventListener('submit', handleManualTicketSubmission);
        }

    } catch (error) {
        console.error('Error initializing Ferris Wheel booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 