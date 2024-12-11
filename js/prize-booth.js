import { db, auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, collection, query, orderBy, limit, getDocs, runTransaction } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { handleExportData } from './export-data.js';

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
        let ticketType = '';
        if (ticket.isBingoCard) {
            ticketType = 'Bingo Card';
        } else if (ticket.isSpecial) {
            ticketType = 'Special Ticket';
        } else {
            ticketType = 'Ticket';
        }
        ticketText.textContent = `${ticketType}: ${ticket.number} (Points: ${ticket.points})`;
        
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
            showMessage(`${ticketType} ${ticket.number} removed successfully!`, 'success');
        };

        // Add elements to ticket item
        ticketItem.appendChild(ticketText);
        ticketItem.appendChild(removeBtn);
        ticketsList.appendChild(ticketItem);
    });
}

// Function to get next special ticket number
async function getNextSpecialTicketNumber() {
    const counterRef = doc(db, 'system', 'specialTicketCounter');
    
    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const currentCounter = counterDoc.exists() ? counterDoc.data().currentNumber : 90000;
            const nextCounter = currentCounter + 1;
            
            transaction.set(counterRef, { currentNumber: nextCounter });
            
            return nextCounter.toString();
        });
        
        return result;
    } catch (error) {
        console.error('Error getting next special ticket number:', error);
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

// Function to show confirmation dialog
function showConfirmationDialog(message, onConfirm, onCancel) {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'dialog-container booth-card';
    
    // Create dialog content
    dialog.innerHTML = `
        <div class="dialog-content">
            <h3>Confirm Redemption</h3>
            <p>${message}</p>
            <div class="dialog-buttons">
                <button class="action-button confirm-button">Yes</button>
                <button class="action-button cancel-button">No</button>
            </div>
        </div>
    `;
    
    // Add dialog to overlay
    overlay.appendChild(dialog);
    
    // Add overlay to body
    document.body.appendChild(overlay);
    
    // Add event listeners
    const confirmBtn = dialog.querySelector('.confirm-button');
    const cancelBtn = dialog.querySelector('.cancel-button');
    
    // Function to remove dialog
    const removeDialog = () => {
        document.body.removeChild(overlay);
    };
    
    // Add click handlers
    confirmBtn.addEventListener('click', async () => {
        await onConfirm();
        removeDialog();
    });
    
    cancelBtn.addEventListener('click', () => {
        onCancel();
        removeDialog();
    });
    
    // Add click outside to cancel
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            onCancel();
            removeDialog();
        }
    });
    
    // Add escape key to cancel
    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            onCancel();
            removeDialog();
            document.removeEventListener('keydown', handler);
        }
    });
}

// Function to finish redeeming process
async function finishRedeeming() {
    if (redeemedTickets.length === 0) {
        showMessage('Please add at least one ticket before finishing', 'error');
        return;
    }

    // Show confirmation dialog
    showConfirmationDialog(
        `Are you sure you want to finish redeeming ${redeemedTickets.length} ticket(s) with a total of ${totalPoints} points?`,
        async () => {
            // Show loading state
            setLoading(true);

            try {
                // Mark all tickets as claimed in Firebase
                for (const ticket of redeemedTickets) {
                    if (ticket.isBingoCard) {
                        // For bingo cards, update both claim and status
                        await updateDoc(ticket.ref, {
                            claim: 'Claimed',
                            status: 'Claimed',
                            claimedAt: serverTimestamp()
                        });
                    } else {
                        // For regular and special tickets
                        await updateDoc(ticket.ref, {
                            claim: 'Claimed',
                            claimedAt: serverTimestamp()
                        });
                    }
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

                showMessage('Tickets redeemed successfully!', 'success');
            } catch (error) {
                showMessage('Error finalizing redemption: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        },
        () => {
            showMessage('Redemption cancelled', 'info');
        }
    );
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

// Function to show message
function showMessage(message, type) {
    if (!ticketStatus) return;
    
    // Use the existing ticket-status div
    ticketStatus.textContent = message;
    ticketStatus.className = `ticket-status ${type}`;

    // Auto clear after 5 seconds
    setTimeout(() => {
        ticketStatus.textContent = '';
        ticketStatus.className = 'ticket-status';
    }, 5000);
}

// Function to show ticket status (now just uses the same function)
function showTicketStatus(message, type) {
    showMessage(message, type);
}

// Function to clear ticket status
function clearTicketStatus() {
    if (!ticketStatus) return;
    ticketStatus.textContent = '';
    ticketStatus.className = 'ticket-status';
}

// Function to format bingo number
function formatBingoNumber(input) {
    // Remove any spaces and convert to uppercase
    input = input.trim().toUpperCase();
    
    // If it's already in the correct format (B followed by numbers), return it
    if (input.match(/^B\d+$/)) {
        return input;
    }
    
    // If it's just numbers, pad it and add the B prefix
    if (input.match(/^\d+$/)) {
        return 'B' + input.padStart(4, '0');
    }
    
    return null;
}

// Function to handle ticket form submission
async function handleTicketSubmission(e) {
    e.preventDefault();
    let ticketNumber = ticketNumberInput.value.trim().toUpperCase();
    
    // Clear previous status
    clearTicketStatus();
    
    // Show loading state
    setLoading(true);

    try {
        let ticketRef;
        let ticketSnap;
        let ticketData;
        let points = 0;
        let isSpecialTicket = false;
        let isBingoCard = false;

        // Check if it's a bingo card (starts with B)
        if (ticketNumber.startsWith('B')) {
            // Try to get bingo card
            ticketRef = doc(db, 'bingoCards', ticketNumber);
            ticketSnap = await getDoc(ticketRef);
            
            if (ticketSnap.exists()) {
                ticketData = ticketSnap.data();
                isBingoCard = true;
                
                // Check if bingo card is completed and has points
                if (ticketData.status !== 'Completed' || ticketData.bonusPoints === 'None') {
                    showTicketStatus('This bingo card is not eligible for redemption!', 'error');
                    setLoading(false);
                    ticketNumberInput.value = '';
                    ticketNumberInput.focus();
                    return;
                }
                
                // Check if bingo card is already claimed
                if (ticketData.claim === 'Claimed' || ticketData.status === 'Claimed') {
                    showTicketStatus('This bingo card has already been claimed!', 'error');
                    setLoading(false);
                    ticketNumberInput.value = '';
                    ticketNumberInput.focus();
                    return;
                }
                
                points = parseInt(ticketData.bonusPoints);
            } else {
                showTicketStatus('Bingo card not found!', 'error');
                setLoading(false);
                ticketNumberInput.value = '';
                ticketNumberInput.focus();
                return;
            }
        } else {
            // Check if it's a special ticket (starts with 9 and is 5 digits)
            isSpecialTicket = ticketNumber.startsWith('9') && ticketNumber.length === 5;
            
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

                ticketData = ticketSnap.data();
                
                // Check if special ticket is already claimed
                if (ticketData.claim === 'Claimed') {
                    showTicketStatus('This special ticket has already been claimed!', 'error');
                    setLoading(false);
                    ticketNumberInput.value = '';
                    ticketNumberInput.focus();
                    return;
                }

                points = ticketData.points || 0;
            } else {
                // Regular ticket
                // Validate that input is a number for regular tickets
                if (!/^\d+$/.test(ticketNumber)) {
                    showTicketStatus('Please enter a valid ticket number', 'error');
                    setLoading(false);
                    return;
                }
                
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

                ticketData = ticketSnap.data();
                
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

                points = ticketData.points || 0;
            }
        }

        // Check if ticket is already in our list
        if (redeemedTickets.some(t => t.number === ticketNumber)) {
            showTicketStatus('This ticket has already been added!', 'error');
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }

        // Add ticket to list
        redeemedTickets.push({
            number: ticketNumber,
            points: points,
            ref: ticketRef,
            isSpecial: isSpecialTicket,
            isBingoCard: isBingoCard
        });
        totalPoints += points;

        // Update UI
        updateSummary();
        updateTicketsList();
        showTicketStatus(`${isBingoCard ? 'Bingo card' : (isSpecialTicket ? 'Special ticket' : 'Ticket')} added successfully!`, 'success');
        
        ticketNumberInput.value = '';
        ticketNumberInput.focus();
    } catch (error) {
        console.error('Error processing ticket:', error);
        showTicketStatus('Error processing ticket!', 'error');
    } finally {
        setLoading(false);
    }
}

// Add the CSS styles to the document
const style = document.createElement('style');
style.textContent = `
    .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 20px;
    }
    
    .dialog-container {
        background: #fff;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-width: 90%;
        width: 400px;
        font-family: 'Poppins', sans-serif;
        margin: auto;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    
    .dialog-content {
        text-align: center;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    
    .dialog-content h3 {
        margin: 0 0 1rem 0;
        color: #333;
        font-size: 1.25rem;
        font-weight: 600;
        width: 100%;
    }
    
    .dialog-content p {
        margin: 0 0 1.5rem 0;
        color: #666;
        line-height: 1.5;
        font-size: 1rem;
        width: 100%;
    }
    
    .dialog-buttons {
        display: flex;
        justify-content: center;
        gap: 1rem;
        width: 100%;
    }
    
    .dialog-buttons button {
        min-width: 100px;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        color: white;
    }
    
    .dialog-buttons .confirm-button {
        background-color: var(--primary-color, #2563eb);
    }
    
    .dialog-buttons .confirm-button:hover {
        background-color: var(--primary-dark, #1d4ed8);
    }
    
    .dialog-buttons .cancel-button {
        background-color: var(--danger-color, #dc2626);
    }
    
    .dialog-buttons .cancel-button:hover {
        background-color: var(--danger-dark, #b91c1c);
    }
`;

// Add the styles to the document head
document.head.appendChild(style);

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize DOM elements
        initializeDOMElements();

        // Update ticket input to accept bingo card numbers
        if (ticketNumberInput) {
            // Remove the pattern attribute as we'll handle validation in JavaScript
            ticketNumberInput.removeAttribute('pattern');
            ticketNumberInput.placeholder = 'Enter ticket or bingo card number';

            // Add hint text below the input
            const hintText = document.createElement('small');
            hintText.className = 'input-hint';
            hintText.textContent = 'For bingo cards, enter the complete number (e.g., B0001)';
            ticketNumberInput.parentNode.insertBefore(hintText, ticketNumberInput.nextSibling);

            // Add input event listener to format the ticket number as user types
            ticketNumberInput.addEventListener('input', function(e) {
                let value = this.value.toUpperCase();
                
                // Allow B prefix and numbers
                if (!value.startsWith('B')) {
                    // If not starting with B, only allow numbers
                    value = value.replace(/\D/g, '');
                } else {
                    // If starts with B, allow B and numbers
                    value = 'B' + value.substring(1).replace(/\D/g, '');
                }
                
                this.value = value;
            });
        }

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
        }

        // Add claim bingo button handler
        const claimBingoBtn = document.getElementById('claimBingoBtn');
        if (claimBingoBtn) {
            claimBingoBtn.addEventListener('click', () => {
                window.location.href = 'claim-bingo.html';
            });
        }

        // Add search ticket button handler
        const searchTicketBtn = document.getElementById('searchTicketBtn');
        if (searchTicketBtn) {
            searchTicketBtn.addEventListener('click', () => {
                window.location.href = 'search-ticket.html';
            });
        }

        // Add export data button handler
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', handleExportData);
        }

    } catch (error) {
        console.error('Error initializing prize booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 