import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, doc, getDoc, setDoc, serverTimestamp, query, orderBy, limit, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize all DOM elements
let quantityForm, ticketForm, messageDiv, logoutBtn, currentTicketSpan, 
    totalTicketsSpan, cancelBtn, loadingText, resultsSection, ticketList, backBtn, manualTicketForm;

let currentTicketCount = 1;
let totalTickets = 0;
let hasReleasedTickets = false;
let generatedTickets = [];
let highestTicketSpan;
let initializedDb;

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

    if (!quantityForm || !ticketForm || !messageDiv || !logoutBtn || 
        !currentTicketSpan || !totalTicketsSpan || !cancelBtn || !loadingText ||
        !resultsSection || !ticketList || !backBtn || !manualTicketForm || !highestTicketSpan) {
        throw new Error('Required DOM elements not found');
    }
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
        ticketItem.textContent = `Ticket Number: ${ticket} (Points: 0)`;
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

// Function to release tickets automatically
async function releaseTickets(startNumber, quantity) {
    generatedTickets = []; // Reset generated tickets array
    
    for (let i = 0; i < quantity; i++) {
        const ticketNumber = padTicketNumber(startNumber + i + 1);
        
        try {
            const ticketRef = doc(db, 'tickets', ticketNumber);
            const ticketSnap = await getDoc(ticketRef);

            if (ticketSnap.exists()) {
                showMessage(`Ticket number ${ticketNumber} already exists! Skipping...`, 'error');
                continue;
            }

            await setDoc(ticketRef, {
                status: 'Released',
                state: 'Unused',
                claim: 'Unclaimed',
                points: 0, // Initialize points to 0
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
}

// Function to setup real-time listener for highest ticket
function setupHighestTicketListener() {
    const ticketsRef = collection(initializedDb, 'tickets');
    const q = query(ticketsRef, orderBy('ticketNumber', 'desc'), limit(1));
    
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty && highestTicketSpan) {
            const highestTicket = snapshot.docs[0].data().ticketNumber;
            const highestNumber = parseInt(highestTicket.replace(/^0+/, ''));
            highestTicketSpan.textContent = padTicketNumber(highestNumber);
        } else if (highestTicketSpan) {
            highestTicketSpan.textContent = '00000';
        }
    }, (error) => {
        console.error('Error listening to highest ticket:', error);
        if (highestTicketSpan) {
            highestTicketSpan.textContent = 'Error loading';
        }
    });
}

// Function to update highest ticket display
async function updateHighestTicketDisplay() {
    try {
        const highestTicket = await getHighestTicketNumber();
        if (highestTicketSpan) {
            highestTicketSpan.textContent = highestTicket ? padTicketNumber(highestTicket) : '00000';
        }
    } catch (error) {
        console.error('Error updating highest ticket:', error);
        if (highestTicketSpan) {
            highestTicketSpan.textContent = 'Error loading';
        }
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
            points: 0,
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
                    const highestTicket = await getHighestTicketNumber();
                    
                    currentTicketCount = 1;
                    totalTickets = quantity;
                    if (totalTicketsSpan) totalTicketsSpan.textContent = quantity;
                    if (currentTicketSpan) currentTicketSpan.textContent = currentTicketCount;
                    
                    hasReleasedTickets = false;
                    if (cancelBtn) cancelBtn.disabled = false;
                    
                    if (quantityForm) quantityForm.style.display = 'none';
                    if (ticketForm) ticketForm.style.display = 'block';

                    await releaseTickets(highestTicket, quantity);
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
                        points: 0,
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

    } catch (error) {
        console.error('Error initializing ticket booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 