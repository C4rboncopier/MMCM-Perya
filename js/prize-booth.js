import { db, auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize DOM elements
let ticketForm, messageDiv, logoutBtn, loadingText, ticketNumberInput,
    submitButton, finishRedeemBtn, cancelRedeemBtn, ticketsListSection, ticketsList,
    totalTicketsSpan, totalPointsSpan, ticketStatus, convertToSpecialBtn;

// Track redeemed tickets
let redeemedTickets = [];
let totalPoints = 0;

// Function to initialize DOM elements
function initializeDOMElements() {
    ticketForm = document.getElementById('ticketForm');
    messageDiv = document.getElementById('message');
    logoutBtn = document.getElementById('logoutBtn');
    loadingText = document.querySelector('.loading-text');
    ticketNumberInput = document.getElementById('ticketNumber');
    submitButton = ticketForm.querySelector('button[type="submit"]');
    finishRedeemBtn = document.getElementById('finishRedeemBtn');
    cancelRedeemBtn = document.getElementById('cancelRedeemBtn');
    ticketsListSection = document.getElementById('ticketsListSection');
    ticketsList = document.getElementById('ticketsList');
    totalTicketsSpan = document.getElementById('totalTickets');
    totalPointsSpan = document.getElementById('totalPoints');
    ticketStatus = document.getElementById('ticketStatus');
    
    // Create convert to special button dynamically
    convertToSpecialBtn = document.createElement('button');
    convertToSpecialBtn.id = 'convertToSpecialBtn';
    convertToSpecialBtn.textContent = 'Convert to Special Ticket';
    convertToSpecialBtn.className = 'action-button';
    convertToSpecialBtn.style.display = 'none';
    convertToSpecialBtn.style.marginBottom = '10px';
    // Insert the button before the finish button
    if (finishRedeemBtn) {
        finishRedeemBtn.parentNode.insertBefore(convertToSpecialBtn, finishRedeemBtn);
    }
    
    if (!ticketForm || !messageDiv || !logoutBtn || !loadingText || 
        !ticketNumberInput || !submitButton || !finishRedeemBtn || !cancelRedeemBtn ||
        !ticketsListSection || !ticketsList || !totalTicketsSpan || !totalPointsSpan || 
        !ticketStatus) {
        throw new Error('Required DOM elements not found');
    }
}

// Function to pad ticket number to 5 digits
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    if (!loadingText || !submitButton || !ticketNumberInput) return;
    
    loadingText.classList.toggle('visible', isLoading);
    submitButton.disabled = isLoading;
    ticketNumberInput.disabled = isLoading;
    
    if (!isLoading) {
        setTimeout(() => ticketNumberInput.focus(), 0);
    }
}

// Function to update summary
function updateSummary() {
    if (!totalTicketsSpan || !totalPointsSpan || !convertToSpecialBtn) return;
    
    totalTicketsSpan.textContent = redeemedTickets.length;
    totalPointsSpan.textContent = totalPoints;

    // Show/hide convert to special ticket button based on points
    convertToSpecialBtn.style.display = totalPoints >= 500 ? 'block' : 'none';
}

// Function to update tickets list
function updateTicketsList() {
    if (!ticketsList) return;

    ticketsList.innerHTML = '';
    redeemedTickets.forEach(ticket => {
        const ticketItem = document.createElement('div');
        ticketItem.className = 'ticket-item';
        
        // Create text content
        const ticketText = document.createElement('span');
        ticketText.textContent = `${ticket.isSpecial ? 'Special ' : ''}Ticket: ${ticket.number} (Points: ${ticket.points})`;
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
            redeemedTickets = redeemedTickets.filter(t => t.number !== ticket.number);
            totalPoints -= ticket.points;

            // Update UI
            updateSummary();
            updateTicketsList();
            showMessage(`${ticket.isSpecial ? 'Special ' : ''}Ticket ${ticket.number} removed successfully!`, 'success');
        };

        // Add elements to ticket item
        ticketItem.appendChild(ticketText);
        ticketItem.appendChild(removeBtn);
        ticketsList.appendChild(ticketItem);
    });
}

// Function to get next special ticket number
async function getNextSpecialTicketNumber() {
    try {
        // Query the specialTickets collection for the latest ticket
        const specialTicketsRef = collection(db, 'specialTickets');
        const q = query(specialTicketsRef, orderBy('ticketNumber', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // If no special tickets exist, start from 90001
            return '90001';
        }

        // Get the latest ticket number and increment it
        const latestTicket = querySnapshot.docs[0];
        const latestNumber = parseInt(latestTicket.id);
        return (latestNumber + 1).toString();
    } catch (error) {
        console.error('Error getting next ticket number:', error);
        throw error;
    }
}

// Function to convert to special ticket
async function convertToSpecialTicket() {
    if (totalPoints < 500) {
        showMessage('Need at least 500 points to create a special ticket', 'error');
        return;
    }

    // Clear any existing ticket status
    clearTicketStatus();
    setLoading(true);

    try {
        // Get the next special ticket number
        const specialTicketNumber = await getNextSpecialTicketNumber();
        
        // Create the special ticket document
        await setDoc(doc(db, 'specialTickets', specialTicketNumber), {
            ticketNumber: specialTicketNumber,
            points: totalPoints,
            createdAt: serverTimestamp(),
            tickets: redeemedTickets.map(t => t.number)
        });

        // Mark original tickets as claimed
        for (const ticket of redeemedTickets) {
            await updateDoc(ticket.ref, {
                claim: 'Claimed',
                claimedAt: serverTimestamp(),
                convertedToSpecial: specialTicketNumber
            });
        }

        showTicketStatus(`Successfully created special ticket: ${specialTicketNumber}`, 'success');

        // Reset everything
        redeemedTickets = [];
        totalPoints = 0;
        updateSummary();
        updateTicketsList();
        
        if (ticketNumberInput) {
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
        }
    } catch (error) {
        showTicketStatus('Error creating special ticket: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Function to finish redeeming process
async function finishRedeeming() {
    if (redeemedTickets.length === 0) {
        showMessage('Please add at least one ticket before finishing', 'error');
        return;
    }

    // Show loading state
    setLoading(true);

    try {
        // Mark all tickets as claimed in Firebase
        for (const ticket of redeemedTickets) {
            await updateDoc(ticket.ref, {
                claim: 'Claimed',
                claimedAt: serverTimestamp()
            });
        }

        // Reset everything
        redeemedTickets = [];
        totalPoints = 0;
        updateSummary();
        updateTicketsList();
        
        if (ticketNumberInput) {
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
        }
    } catch (error) {
        showMessage('Error finalizing redemption: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Function to reset redemption
function resetRedemption() {
    redeemedTickets = [];
    totalPoints = 0;
    updateSummary();
    updateTicketsList();
    clearTicketStatus();
    if (ticketNumberInput) {
        ticketNumberInput.value = '';
        ticketNumberInput.focus();
    }
}

// Function to show ticket status
function showTicketStatus(message, type) {
    if (!ticketStatus) return;
    
    ticketStatus.textContent = message;
    ticketStatus.className = `ticket-status ${type}`;
}

// Function to clear ticket status
function clearTicketStatus() {
    if (!ticketStatus) return;
    ticketStatus.textContent = '';
    ticketStatus.className = 'ticket-status';
}

// Function to handle ticket form submission
async function handleTicketSubmission(e) {
    e.preventDefault();
    let ticketNumber = ticketNumberInput.value;
    
    // Clear previous status
    clearTicketStatus();
    
    // Validate that input is a number
    if (!/^\d+$/.test(ticketNumber)) {
        showTicketStatus('Please enter a valid number', 'error');
        return;
    }

    // Show loading state
    setLoading(true);

    try {
        // Check if it's a special ticket (starts with 9 and is 5 digits)
        const isSpecialTicket = ticketNumber.startsWith('9') && ticketNumber.length === 5;
        let ticketRef;
        let ticketSnap;

        if (isSpecialTicket) {
            ticketRef = doc(db, 'specialTickets', ticketNumber);
            ticketSnap = await getDoc(ticketRef);
            
            if (!ticketSnap.exists()) {
                showTicketStatus('Special ticket not found!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            const ticketData = ticketSnap.data();
            
            // Check if special ticket is already claimed
            if (ticketData.claim === 'Claimed') {
                showTicketStatus('This special ticket has already been claimed!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            // Add special ticket to list
            redeemedTickets.push({
                number: ticketNumber,
                points: ticketData.points || 0,
                ref: ticketRef,
                isSpecial: true
            });
            totalPoints += ticketData.points || 0;
        } else {
            // Pad the regular ticket number to 5 digits
            ticketNumber = padTicketNumber(ticketNumber);
            ticketRef = doc(db, 'tickets', ticketNumber);
            ticketSnap = await getDoc(ticketRef);

            if (!ticketSnap.exists()) {
                showTicketStatus('Ticket not found!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            const ticketData = ticketSnap.data();
            
            // Check if regular ticket is already claimed
            if (ticketData.claim === 'Claimed') {
                showTicketStatus('This ticket has already been claimed!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            // Check specific ticket states
            if (ticketData.status !== 'Released') {
                showTicketStatus('Invalid ticket!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }
            
            if (ticketData.state !== 'Used') {
                showTicketStatus('Ticket has not been used in a game yet!', 'warning');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            // Check if ticket is already in our list
            if (redeemedTickets.some(t => t.number === ticketNumber)) {
                showTicketStatus('This ticket has already been added!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }

            // Add regular ticket to list
            redeemedTickets.push({
                number: ticketNumber,
                points: ticketData.points || 0,
                ref: ticketRef
            });
            totalPoints += ticketData.points || 0;
        }

        // Update UI
        updateSummary();
        updateTicketsList();
        showTicketStatus('Ticket added successfully!', 'success');
        
        ticketNumberInput.value = '';
        ticketNumberInput.focus();
    } catch (error) {
        showMessage('Error processing ticket: ' + error.message, 'error');
        showTicketStatus('Error processing ticket!', 'error');
    } finally {
        setLoading(false);
    }
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize DOM elements
        initializeDOMElements();

        // Add logout functionality
        if (logoutBtn) {
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
        }

        // Add cancel button handler
        if (cancelRedeemBtn) {
            cancelRedeemBtn.addEventListener('click', () => {
                if (redeemedTickets.length === 0) {
                    showMessage('No tickets to cancel', 'error');
                    return;
                }
                resetRedemption();
                showMessage('All tickets removed', 'success');
            });
        }

        // Add finish redeem button handler
        if (finishRedeemBtn) {
            finishRedeemBtn.addEventListener('click', finishRedeeming);
        }

        // Add convert to special ticket button handler
        if (convertToSpecialBtn) {
            convertToSpecialBtn.addEventListener('click', convertToSpecialTicket);
        }

        // Add form submission handler
        if (ticketForm) {
            ticketForm.addEventListener('submit', handleTicketSubmission);

            // Add input event listener to format the ticket number as user types
            if (ticketNumberInput) {
                ticketNumberInput.addEventListener('input', function(e) {
                    // Remove any non-digit characters
                    let value = this.value.replace(/\D/g, '');
                    this.value = value;
                });
            }
        }

    } catch (error) {
        console.error('Error initializing prize booth:', error);
        showMessage('Error initializing the application', 'error');
    }
});

function showMessage(message, type) {
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
} 