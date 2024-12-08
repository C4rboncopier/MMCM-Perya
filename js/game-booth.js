import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let ticketForm, messageDiv, logoutBtn, loadingText, ticketNumberInput, scoreInput, submitButton, boothTitle, totalTicketsSpan;
let initializedDb;

// Function to fetch booth data
async function fetchBoothData() {
    try {
        const username = localStorage.getItem('gameName');
        if (!username) return;

        const boothRef = doc(initializedDb, 'gameBooths', username);
        const boothSnap = await getDoc(boothRef);

        if (boothSnap.exists()) {
            const boothData = boothSnap.data();
            // Update title with boothName instead of username
            if (boothTitle) {
                boothTitle.textContent = boothData.boothName || boothData.username; // Fallback to username if boothName doesn't exist
            }
            // Update total tickets if element exists
            if (totalTicketsSpan) {
                totalTicketsSpan.textContent = boothData.totalTickets || 0;
            }
        }
    } catch (error) {
        console.error('Error fetching booth data:', error);
        showMessage('Error loading booth data', 'error');
    }
}

// Function to pad ticket number to 5 digits
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    loadingText.classList.toggle('visible', isLoading);
    submitButton.disabled = isLoading;
    ticketNumberInput.disabled = isLoading;
    scoreInput.disabled = isLoading;
    
    // Focus the input when loading is done
    if (!isLoading) {
        setTimeout(() => ticketNumberInput.focus(), 0);
    }
}

function showMessage(message, type) {
    if (!messageDiv) return;
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase first
    const { db: firebaseDb, auth: firebaseAuth } = await initializeFirebase();
    initializedDb = firebaseDb;

    // Initialize DOM elements
    ticketForm = document.getElementById('ticketForm');
    messageDiv = document.getElementById('message');
    logoutBtn = document.getElementById('logoutBtn');
    loadingText = document.querySelector('.loading-text');
    ticketNumberInput = document.getElementById('ticketNumber');
    scoreInput = document.getElementById('score');
    submitButton = ticketForm.querySelector('button[type="submit"]');
    boothTitle = document.querySelector('.booth-title');
    totalTicketsSpan = document.querySelector('.total-tickets');

    // Fetch booth data
    await fetchBoothData();

    // Add logout functionality
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(firebaseAuth);
            localStorage.removeItem('boothType');
            localStorage.removeItem('gameName');
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
        let score = parseInt(scoreInput.value);
        
        // Validate that ticket input is a number
        if (!/^\d+$/.test(ticketNumber)) {
            showMessage('Please enter a valid ticket number', 'error');
            return;
        }

        // Validate score
        if (isNaN(score) || score < 0) {
            showMessage('Please enter a valid score', 'error');
            return;
        }

        // Show loading state
        setLoading(true);

        // Pad the ticket number to 5 digits
        ticketNumber = padTicketNumber(ticketNumber);

        try {
            const ticketRef = doc(initializedDb, 'tickets', ticketNumber);
            const ticketSnap = await getDoc(ticketRef);

            if (!ticketSnap.exists()) {
                showMessage('Ticket not found!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                scoreInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            const ticketData = ticketSnap.data();
            
            // Check specific ticket states and show appropriate messages
            if (ticketData.status !== 'Released') {
                showMessage('Invalid ticket!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                scoreInput.value = '';
                ticketNumberInput.focus();
                return;
            }
            
            if (ticketData.state === 'Used') {
                showMessage('Ticket already used!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                scoreInput.value = '';
                ticketNumberInput.focus();
                return;
            }
            
            if (ticketData.claim !== 'Unclaimed') {
                showMessage('Prize already claimed for this ticket!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                scoreInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            // Update ticket status
            await updateDoc(ticketRef, {
                state: 'Used',
                points: score,
                usedAt: serverTimestamp()
            });

            // Update game booth total tickets
            const username = localStorage.getItem('gameName');
            if (username) {
                const boothRef = doc(initializedDb, 'gameBooths', username);
                const boothSnap = await getDoc(boothRef);
                
                if (boothSnap.exists()) {
                    const currentTotal = boothSnap.data().totalTickets || 0;
                    await updateDoc(boothRef, {
                        totalTickets: currentTotal + 1,
                        lastUpdated: serverTimestamp()
                    });
                    
                    // Update the display
                    if (totalTicketsSpan) {
                        totalTicketsSpan.textContent = currentTotal + 1;
                    }
                }
            }

            showMessage(`Ticket used successfully! Score: ${score}`, 'success');
            ticketNumberInput.value = '';
            scoreInput.value = '';
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
}); 