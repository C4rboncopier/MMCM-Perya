import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let ticketForm, messageDiv, logoutBtn, loadingText, ticketNumberInput, scoreInput, submitButton, boothTitle, totalTicketsSpan, historyList;
let initializedDb;
let boothName = '';

// Function to initialize DOM elements
function initializeDOMElements() {
    ticketForm = document.getElementById('ticketForm');
    messageDiv = document.getElementById('message');
    logoutBtn = document.getElementById('logoutBtn');
    loadingText = document.querySelector('.loading-text');
    ticketNumberInput = document.getElementById('ticketNumber');
    scoreInput = document.getElementById('score');
    submitButton = ticketForm.querySelector('button[type="submit"]');
    boothTitle = document.querySelector('.booth-title');
    totalTicketsSpan = document.querySelector('.total-tickets');
    historyList = document.getElementById('historyList');

    if (!ticketForm || !messageDiv || !logoutBtn || !loadingText || !ticketNumberInput || 
        !scoreInput || !submitButton || !boothTitle || !totalTicketsSpan || !historyList) {
        throw new Error('Required DOM elements not found');
    }

    // Get booth name from localStorage
    boothName = localStorage.getItem('gameName') || '';
}

// Function to fetch and display ticket history
async function fetchTicketHistory() {
    if (!historyList || !boothName || !initializedDb) return;

    try {
        console.log('Fetching ticket history for booth:', boothName);
        const boothRef = doc(initializedDb, 'gameBooths', boothName);
        const boothSnap = await getDoc(boothRef);

        historyList.innerHTML = ''; // Clear existing history

        if (!boothSnap.exists() || !boothSnap.data().ticketHistory) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'history-item empty';
            emptyMessage.textContent = 'No tickets have been processed yet';
            historyList.appendChild(emptyMessage);
            return;
        }

        const ticketHistory = boothSnap.data().ticketHistory || [];
        
        // Sort by timestamp in descending order (newest first)
        ticketHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        ticketHistory.forEach((ticket) => {
            const ticketItem = document.createElement('div');
            ticketItem.className = 'history-item';

            // Create ticket number element
            const ticketNumber = document.createElement('div');
            ticketNumber.className = 'ticket-number';
            ticketNumber.textContent = `#${ticket.ticketNumber}`;

            // Create points element
            const points = document.createElement('div');
            points.className = 'points';
            points.textContent = `${ticket.points} Points`;

            // Create timestamp element
            const timestamp = document.createElement('div');
            timestamp.className = 'timestamp';
            const date = ticket.timestamp ? new Date(ticket.timestamp).toLocaleString() : 'N/A';
            timestamp.textContent = date;

            // Add all elements to the ticket item
            ticketItem.appendChild(ticketNumber);
            ticketItem.appendChild(points);
            ticketItem.appendChild(timestamp);
            
            historyList.appendChild(ticketItem);
        });
    } catch (error) {
        console.error('Error fetching ticket history:', error);
        showMessage('Error loading ticket history', 'error');
        
        // Show error in history list
        historyList.innerHTML = '';
        const errorMessage = document.createElement('div');
        errorMessage.className = 'history-item error';
        errorMessage.textContent = 'Error loading ticket history. Please try again later.';
        historyList.appendChild(errorMessage);
    }
}

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

// Function to show message
function showMessage(message, type) {
    if (!messageDiv) return;
    
    // Create or get the message container above ticket history
    let messageContainer = document.querySelector('.message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        const ticketHistory = document.getElementById('ticketHistory');
        if (ticketHistory) {
            ticketHistory.parentNode.insertBefore(messageContainer, ticketHistory);
        }
    }

    // Create new message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'message-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => messageElement.remove();
    messageElement.appendChild(closeButton);

    // Add to container
    messageContainer.appendChild(messageElement);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
            messageElement.remove();
        }
    }, 5000);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase first
        const { db: firebaseDb, auth: firebaseAuth } = await initializeFirebase();
        initializedDb = firebaseDb;

        // Initialize DOM elements
        initializeDOMElements();

        // Fetch booth data and ticket history
        await fetchBoothData();
        await fetchTicketHistory();

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

        // Handle ticket form submission
        if (ticketForm) {
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
                        const usedByBooth = ticketData.booth || 'unknown booth';
                        const usedAt = ticketData.usedAt ? new Date(ticketData.usedAt.toDate()).toLocaleString() : 'unknown time';
                        showMessage(`This ticket has already been used by ${usedByBooth} on ${usedAt}`, 'error');
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

                    // Get booth reference first
                    const boothRef = doc(initializedDb, 'gameBooths', boothName);
                    const boothSnap = await getDoc(boothRef);
                    
                    if (!boothSnap.exists()) {
                        showMessage('Error: Booth not found!', 'error');
                        setLoading(false);
                        return;
                    }

                    // Get current booth data
                    const currentTotal = boothSnap.data().totalTickets || 0;
                    const currentHistory = boothSnap.data().ticketHistory || [];

                    // Create new ticket history entry with current date
                    const newTicketHistory = {
                        ticketNumber: ticketNumber,
                        points: score,
                        timestamp: new Date().toISOString() // Use ISO string format instead of serverTimestamp
                    };

                    // Update both documents in a batch
                    const batch = writeBatch(initializedDb);

                    // Update ticket document
                    batch.update(ticketRef, {
                        state: 'Used',
                        points: score,
                        booth: boothName,
                        usedAt: serverTimestamp() // Keep serverTimestamp for the ticket document
                    });

                    // Update booth document
                    batch.update(boothRef, {
                        totalTickets: currentTotal + 1,
                        lastUpdated: serverTimestamp(),
                        ticketHistory: [...currentHistory, newTicketHistory]
                    });

                    // Commit the batch
                    await batch.commit();

                    // Update the display
                    if (totalTicketsSpan) {
                        totalTicketsSpan.textContent = currentTotal + 1;
                    }

                    showMessage(`Ticket used successfully! Score: ${score}`, 'success');
                    ticketNumberInput.value = '';
                    scoreInput.value = '';
                    ticketNumberInput.focus();

                    // Refresh ticket history
                    await fetchTicketHistory();
                } catch (error) {
                    console.error('Error processing ticket:', error);
                    showMessage('Error processing ticket: ' + error.message, 'error');
                } finally {
                    // Hide loading state
                    setLoading(false);
                }
            });
        }

        // Add input event listener to format the ticket number as user types
        if (ticketNumberInput) {
            ticketNumberInput.addEventListener('input', function(e) {
                // Remove any non-digit characters
                let value = this.value.replace(/\D/g, '');
                
                // Update the input value with the cleaned number
                this.value = value;
            });
        }
    } catch (error) {
        console.error('Error initializing Game booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 