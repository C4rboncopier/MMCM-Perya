import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp, query, orderBy, limit, getDocs, onSnapshot, runTransaction, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize all DOM elements
let quantityForm, ticketForm, messageDiv, logoutBtn, currentTicketSpan, 
    totalTicketsSpan, cancelBtn, loadingText, resultsSection, ticketList, backBtn, manualTicketForm, countTicketsBtn;

let currentTicketCount = 1;
let totalTickets = 0;
let hasReleasedTickets = false;
let generatedTickets = [];
let highestTicketSpan;
let initializedDb;
let boothName = '';

// Function to initialize DOM elements
function initializeDOMElements() {
    quantityForm = document.getElementById('quantityForm');
    ticketForm = document.getElementById('ticketForm');
    messageDiv = document.getElementById('message');
    logoutBtn = document.getElementById('logoutBtn');
    currentTicketSpan = document.getElementById('currentTicket');
    totalTicketsSpan = document.getElementById('totalTickets');
    cancelBtn = document.getElementById('cancelBtn');
    loadingText = document.querySelector('.loading-text');
    resultsSection = document.getElementById('resultsSection');
    ticketList = document.getElementById('ticketList');
    backBtn = document.getElementById('backBtn');
    manualTicketForm = document.getElementById('manualTicketForm');
    highestTicketSpan = document.getElementById('highestTicket');
    countTicketsBtn = document.getElementById('countTicketsBtn');

    if (!quantityForm || !ticketForm || !messageDiv || !logoutBtn || 
        !currentTicketSpan || !totalTicketsSpan || !cancelBtn || !loadingText ||
        !resultsSection || !ticketList || !backBtn || !manualTicketForm || !highestTicketSpan ||
        !countTicketsBtn) {
        throw new Error('Required DOM elements not found');
    }

    // Get booth name from localStorage
    boothName = localStorage.getItem('boothName') || '';
}

// Function to pad ticket number to 5 digits
export function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    if (!loadingText || !cancelBtn) return;
    
    loadingText.classList.toggle('visible', isLoading);
    cancelBtn.disabled = isLoading || hasReleasedTickets;

    // Disable manual ticket form during automatic generation
    if (manualTicketForm) {
        const manualSubmitBtn = manualTicketForm.querySelector('button[type="submit"]');
        const manualInput = manualTicketForm.querySelector('input');
        if (manualSubmitBtn && manualInput) {
            manualSubmitBtn.disabled = isLoading;
            manualInput.disabled = isLoading;
            manualTicketForm.style.opacity = isLoading ? '0.5' : '1';
        }
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

// Function to show the results section
function showResults() {
    if (!resultsSection || !ticketList || !quantityForm || !ticketForm) return;

    // Hide other forms
    quantityForm.style.display = 'none';
    ticketForm.style.display = 'none';

    // Clear previous results
    ticketList.innerHTML = '';

    // Add each ticket to the list
    generatedTickets.forEach(ticket => {
        const ticketItem = document.createElement('div');
        ticketItem.className = 'ticket-item';
        
        // Create ticket text
        const ticketText = document.createElement('span');
        ticketText.textContent = `Ticket Number: ${ticket} (Points: None)`;
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = async () => {
            try {
                const ticketRef = doc(db, 'tickets', ticket);
                await deleteDoc(ticketRef);
                
                // Remove from generated tickets array
                generatedTickets = generatedTickets.filter(t => t !== ticket);
                
                // Remove from display
                ticketItem.remove();
                
                showMessage(`Ticket ${ticket} deleted successfully!`, 'success');
            } catch (error) {
                showMessage(`Error deleting ticket ${ticket}: ${error.message}`, 'error');
            }
        };
        
        // Add elements to ticket item
        ticketItem.appendChild(ticketText);
        ticketItem.appendChild(deleteBtn);
        ticketList.appendChild(ticketItem);
    });

    // Show results section
    resultsSection.style.display = 'block';
}

// Function to reset everything and go back to quantity form
function resetToQuantityForm() {
    if (!quantityForm || !ticketForm || !resultsSection) return;

    // Reset variables
    currentTicketCount = 1;
    totalTickets = 0;
    hasReleasedTickets = false;
    generatedTickets = [];

    // Hide other sections
    ticketForm.style.display = 'none';
    resultsSection.style.display = 'none';

    // Show quantity form
    quantityForm.style.display = 'block';
    
    // Reset the form
    quantityForm.reset();
}

// Function to get the highest ticket number from Firebase
export async function getHighestTicketNumber() {
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, orderBy('ticketNumber', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const highestTicket = querySnapshot.docs[0].data().ticketNumber;
            // Since ticketNumber is stored as a padded string (e.g., "00123"),
            // we need to convert it to a number by removing leading zeros
            return parseInt(highestTicket.replace(/^0+/, ''));
        }
        return 0; // If no tickets exist yet
    } catch (error) {
        console.error('Error getting highest ticket number:', error);
        return 0;
    }
}

// Function to get next ticket number atomically
async function getNextTicketNumber(quantity) {
    const ticketCounterRef = doc(db, 'system', 'ticketCounter');
    
    try {
        const result = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(ticketCounterRef);
            const currentCounter = counterDoc.exists() ? counterDoc.data().currentNumber : 0;
            const nextCounter = currentCounter + quantity;
            
            transaction.set(ticketCounterRef, { currentNumber: nextCounter });
            
            return currentCounter;
        });
        
        return result;
    } catch (error) {
        console.error('Error getting next ticket number:', error);
        throw error;
    }
}

// Function to release tickets automatically
async function releaseTickets(quantity) {
    generatedTickets = []; // Reset generated tickets array
    
    try {
        const startNumber = await getNextTicketNumber(quantity);
        
        for (let i = 0; i < quantity; i++) {
            const ticketNumber = padTicketNumber(startNumber + i + 1);
            
            try {
                const ticketRef = doc(db, 'tickets', ticketNumber);
                await setDoc(ticketRef, {
                    status: 'Released',
                    state: 'Unused',
                    claim: 'Unclaimed',
                    points: 'None',
                    booth: boothName,
                    createdAt: serverTimestamp(),
                    ticketNumber: ticketNumber
                });

                hasReleasedTickets = true;
                if (cancelBtn) cancelBtn.disabled = true;

                // Add to generated tickets array
                generatedTickets.push(ticketNumber);

                showMessage(`Ticket ${ticketNumber} released successfully!`, 'success');
                
                if (currentTicketSpan) {
                    currentTicketCount = i + 1; // Update to current count (1-based)
                    currentTicketSpan.textContent = currentTicketCount;
                }

                // Small delay to prevent overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                showMessage(`Error releasing ticket ${ticketNumber}: ${error.message}`, 'error');
            }
        }
        
        // Show results instead of resetting
        showResults();
        showMessage('All tickets have been released successfully!', 'success');
    } catch (error) {
        showMessage('Error generating tickets: ' + error.message, 'error');
        throw error;
    }
}

// Function to setup highest ticket listener
function setupHighestTicketListener() {
    if (!highestTicketSpan) return;

    const ticketCounterRef = doc(db, 'system', 'ticketCounter');
    
    return onSnapshot(ticketCounterRef, (snapshot) => {
        if (snapshot.exists()) {
            const currentNumber = snapshot.data().currentNumber;
            highestTicketSpan.textContent = padTicketNumber(currentNumber);
        } else {
            highestTicketSpan.textContent = '00000';
        }
    }, (error) => {
        console.error('Error getting highest ticket:', error);
        highestTicketSpan.textContent = 'Error';
    });
}

// Function to update highest ticket display
async function updateHighestTicketDisplay() {
    if (!highestTicketSpan) return;
    
    try {
        const ticketCounterRef = doc(db, 'system', 'ticketCounter');
        const counterDoc = await getDoc(ticketCounterRef);
        
        if (counterDoc.exists()) {
            const currentNumber = counterDoc.data().currentNumber;
            highestTicketSpan.textContent = padTicketNumber(currentNumber);
        } else {
            highestTicketSpan.textContent = '00000';
        }
    } catch (error) {
        console.error('Error updating highest ticket display:', error);
        highestTicketSpan.textContent = 'Error';
    }
}

// Function to handle manual ticket submission
async function handleManualTicketSubmission(e) {
    e.preventDefault();
    let ticketNumber = document.getElementById('manualTicketNumber').value;

    // Validate that input is a number
    if (!/^\d+$/.test(ticketNumber)) {
        showMessage('Please enter a valid number', 'error');
        return;
    }

    // Pad the ticket number to 5 digits
    ticketNumber = padTicketNumber(ticketNumber);

    try {
        const ticketRef = doc(db, 'tickets', ticketNumber);
        const ticketSnap = await getDoc(ticketRef);

        if (ticketSnap.exists()) {
            showMessage(`Ticket number ${ticketNumber} already exists!`, 'error');
            return;
        }

        await setDoc(ticketRef, {
            status: 'Released',
            state: 'Unused',
            claim: 'Unclaimed',
            points: 'None',
            booth: boothName,
            createdAt: serverTimestamp(),
            ticketNumber: ticketNumber
        });

        showMessage(`Ticket ${ticketNumber} added successfully!`, 'success');
        document.getElementById('manualTicketNumber').value = '';
        // Update highest ticket display after adding a new ticket
        await updateHighestTicketDisplay();
    } catch (error) {
        showMessage(`Error adding ticket ${ticketNumber}: ${error.message}`, 'error');
    }
}

// Add new function to count tickets
async function countTotalTickets() {
    try {
        const ticketsRef = collection(db, 'tickets');
        const snapshot = await getDocs(ticketsRef);
        const totalTickets = snapshot.size;

        // Create popup container
        const popupContainer = document.createElement('div');
        popupContainer.className = 'popup-container';
        
        // Create popup content
        const popup = document.createElement('div');
        popup.className = 'popup';
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Total Tickets Count';
        title.className = 'popup-title';
        
        // Add count
        const count = document.createElement('p');
        count.textContent = `Total number of tickets: ${totalTickets}`;
        count.className = 'popup-count';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'action-button';
        closeBtn.onclick = () => {
            document.body.removeChild(popupContainer);
        };
        
        // Assemble popup
        popup.appendChild(title);
        popup.appendChild(count);
        popup.appendChild(closeBtn);
        popupContainer.appendChild(popup);
        
        // Add to body
        document.body.appendChild(popupContainer);
        
    } catch (error) {
        showMessage('Error counting tickets: ' + error.message, 'error');
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
                    localStorage.removeItem('boothName');
                    window.location.href = '../pages/login.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    showMessage('Error signing out', 'error');
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (!hasReleasedTickets) {
                    resetToQuantityForm();
                    showMessage('Ticket release cancelled', 'success');
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                resetToQuantityForm();
            });
        }

        if (quantityForm) {
            quantityForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const quantity = parseInt(document.getElementById('ticketQuantity').value);
                
                if (quantity < 1) {
                    showMessage('Please enter a valid quantity', 'error');
                    return;
                }

                setLoading(true);

                try {
                    currentTicketCount = 1;
                    totalTickets = quantity;
                    if (totalTicketsSpan) totalTicketsSpan.textContent = quantity;
                    if (currentTicketSpan) currentTicketSpan.textContent = currentTicketCount;
                    
                    hasReleasedTickets = false;
                    if (cancelBtn) cancelBtn.disabled = false;
                    
                    if (quantityForm) quantityForm.style.display = 'none';
                    if (ticketForm) ticketForm.style.display = 'block';

                    await releaseTickets(quantity);
                } catch (error) {
                    showMessage('Error: ' + error.message, 'error');
                    resetToQuantityForm();
                } finally {
                    setLoading(false);
                }
            });
        }

        if (manualTicketForm) {
            manualTicketForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                let ticketNumber = document.getElementById('manualTicketNumber').value;

                // Validate that input is a number
                if (!/^\d+$/.test(ticketNumber)) {
                    showMessage('Please enter a valid number', 'error');
                    return;
                }

                // Pad the ticket number to 5 digits
                ticketNumber = padTicketNumber(ticketNumber);

                try {
                    const ticketRef = doc(db, 'tickets', ticketNumber);
                    const ticketSnap = await getDoc(ticketRef);

                    if (ticketSnap.exists()) {
                        showMessage(`Ticket number ${ticketNumber} already exists!`, 'error');
                        return;
                    }

                    await setDoc(ticketRef, {
                        status: 'Released',
                        state: 'Unused',
                        claim: 'Unclaimed',
                        points: 'None',
                        booth: boothName,
                        createdAt: serverTimestamp(),
                        ticketNumber: ticketNumber
                    });

                    showMessage(`Ticket ${ticketNumber} added successfully!`, 'success');
                    document.getElementById('manualTicketNumber').value = '';
                } catch (error) {
                    showMessage(`Error adding ticket ${ticketNumber}: ${error.message}`, 'error');
                }
            });
        }

        // Add count tickets button handler
        if (countTicketsBtn) {
            countTicketsBtn.addEventListener('click', countTotalTickets);
        }

        // Add generate bingo card button handler
        const generateBingoBtn = document.getElementById('generateBingoBtn');
        if (generateBingoBtn) {
            generateBingoBtn.addEventListener('click', () => {
                window.location.href = 'bingo-card.html';
            });
        }

    } catch (error) {
        console.error('Error initializing ticket booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 