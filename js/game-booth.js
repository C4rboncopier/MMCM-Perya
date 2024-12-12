import { db, auth, initializeFirebase } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs, writeBatch, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let ticketForm, ticketNumberInput, scoreInput, messageDiv, submitButton, loadingText,
    totalTicketsSpan, historyList, logoutBtn, boothTitle, bingoVisitForm, bingoNumberInput;
let initializedDb;
let boothName = '';

// Function to initialize DOM elements
function initializeDOMElements() {
    ticketForm = document.getElementById('ticketForm');
    ticketNumberInput = document.getElementById('ticketNumber');
    scoreInput = document.getElementById('score');
    messageDiv = document.getElementById('message');
    submitButton = ticketForm ? ticketForm.querySelector('button[type="submit"]') : null;
    loadingText = document.querySelector('.loading-text');
    totalTicketsSpan = document.querySelector('.total-tickets');
    historyList = document.getElementById('historyList');
    logoutBtn = document.getElementById('logoutBtn');
    boothTitle = document.querySelector('.booth-title');
    bingoVisitForm = document.getElementById('bingoVisitForm');
    bingoNumberInput = document.getElementById('bingoNumber');

    if (!ticketForm || !ticketNumberInput || !scoreInput || !messageDiv || !submitButton || 
        !loadingText || !totalTicketsSpan || !historyList || !logoutBtn || !bingoVisitForm || 
        !bingoNumberInput) {
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

// Function to set loading state
function setLoading(isLoading, form = 'ticket') {
    const loadingText = form === 'ticket' ? 
        document.querySelector('#ticketForm .loading-text') : 
        document.querySelector('#bingoVisitForm .loading-text');
    
    const submitBtn = form === 'ticket' ? 
        ticketForm.querySelector('button[type="submit"]') : 
        bingoVisitForm.querySelector('button[type="submit"]');

    if (loadingText) loadingText.classList.toggle('visible', isLoading);
    if (submitBtn) submitBtn.disabled = isLoading;

    if (form === 'ticket') {
        if (ticketNumberInput) ticketNumberInput.disabled = isLoading;
        if (scoreInput) scoreInput.disabled = isLoading;
        // Focus the input when loading is done
        if (!isLoading) {
            setTimeout(() => ticketNumberInput.focus(), 0);
        }
    } else {
        if (bingoNumberInput) bingoNumberInput.disabled = isLoading;
        // Focus the input when loading is done
        if (!isLoading) {
            setTimeout(() => bingoNumberInput.focus(), 0);
        }
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

// Function to generate raffle ticket number
async function generateRaffleTicketNumber() {
    try {
        const counterRef = doc(db, 'system', 'raffleTicketCounter');
        const counterSnap = await getDoc(counterRef);
        
        let currentNumber = 0;
        if (counterSnap.exists()) {
            currentNumber = counterSnap.data().currentNumber;
            await updateDoc(counterRef, {
                currentNumber: currentNumber + 1,
                lastUpdated: serverTimestamp()
            });
        } else {
            // Initialize the counter if it doesn't exist
            await setDoc(counterRef, {
                currentNumber: 1,
                lastUpdated: serverTimestamp()
            });
            currentNumber = 0; // First ticket will be R0001
        }
        
        const nextNumber = currentNumber + 1;
        return 'R' + nextNumber.toString().padStart(4, '0');
    } catch (error) {
        console.error('Error generating raffle ticket number:', error);
        throw error;
    }
}

// Function to generate raffle entries for bingo card
async function generateRaffleEntries(bingoNumber, bingoData) {
    try {
        // Generate 2 raffle tickets
        const raffleTicket1 = await generateRaffleTicketNumber();
        const raffleTicket2 = await generateRaffleTicketNumber();
        
        // Create raffle tickets in Firestore
        const raffleRef1 = doc(db, 'raffleTickets', raffleTicket1);
        const raffleRef2 = doc(db, 'raffleTickets', raffleTicket2);
        
        const ticketData = {
            ticketNumber: '',  // Will be set individually
            bingoCard: bingoNumber,
            email: bingoData.email,     // Add email from bingo data
            name: bingoData.name,       // Add name from bingo data
            createdAt: serverTimestamp(),
            status: 'Active'
        };
        
        await setDoc(raffleRef1, {
            ...ticketData,
            ticketNumber: raffleTicket1
        });
        
        await setDoc(raffleRef2, {
            ...ticketData,
            ticketNumber: raffleTicket2
        });
        
        return [raffleTicket1, raffleTicket2];
    } catch (error) {
        console.error('Error generating raffle entries:', error);
        throw error;
    }
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

                // Validate maximum score
                if (score > 15) {
                    showMessage('Maximum score allowed is 15 points', 'error');
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
                this.value = value;
            });
        }

        // Add input event listener for score validation
        if (scoreInput) {
            scoreInput.addEventListener('input', function(e) {
                const value = parseInt(this.value);
                if (value > 15) {
                    this.value = 15;
                    showMessage('Maximum score allowed is 15 points', 'error');
                }
            });
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

        // Function to handle bingo card visit
        async function handleBingoVisit(e) {
            e.preventDefault();
            
            const rawBingoNumber = bingoNumberInput.value.trim();
            const bingoNumber = formatBingoNumber(rawBingoNumber);
            
            // Validate bingo number format
            if (!bingoNumber) {
                showMessage('Please enter a valid bingo card number or ID', 'error');
                return;
            }
            
            setLoading(true, 'bingo');
            
            try {
                const bingoRef = doc(db, 'bingoCards', bingoNumber);
                const bingoSnap = await getDoc(bingoRef);
                
                if (!bingoSnap.exists()) {
                    showMessage('Bingo card not found!', 'error');
                    setLoading(false, 'bingo');
                    return;
                }
                
                const bingoData = bingoSnap.data();
                const boothName = localStorage.getItem('gameName');
                
                // Check if this booth has already been visited
                if (bingoData.visitedBooths && bingoData.visitedBooths.includes(boothName)) {
                    showMessage('This booth has already been visited with this bingo card!', 'error');
                    setLoading(false, 'bingo');
                    return;
                }
                
                // Update bingo card with new visit
                const updatedVisits = [...(bingoData.visitedBooths || []), boothName];
                const updates = {
                    visitedBooths: updatedVisits,
                    boothVisits: updatedVisits.length,
                    lastUpdated: serverTimestamp()
                };

                // Check if this visit makes it the 14th booth visit
                if (updatedVisits.length === 14 && bingoData.raffleEntries === 'None') {
                    try {
                        const raffleTickets = await generateRaffleEntries(bingoNumber, bingoData);
                        updates.raffleEntries = raffleTickets;
                        showMessage(`Bingo card visit recorded and raffle tickets (${raffleTickets.join(', ')}) generated successfully!`, 'success');
                    } catch (error) {
                        console.error('Error generating raffle tickets:', error);
                        showMessage('Visit recorded but there was an error generating raffle tickets.', 'warning');
                    }
                } 
                // Check if this is the 21st booth visit
                else if (updatedVisits.length === 21 && bingoData.bonusPoints === 'None') {
                    updates.bonusPoints = '100';
                    updates.status = 'Completed';
                    showMessage('Congratulations! Your bingo card is now worth 100 points!', 'success');
                } else {
                    showMessage('Bingo card visit recorded successfully!', 'success');
                }

                await updateDoc(bingoRef, updates);
                bingoNumberInput.value = '';
                
            } catch (error) {
                console.error('Error recording bingo visit:', error);
                showMessage('Error recording visit. Please try again.', 'error');
            } finally {
                setLoading(false, 'bingo');
            }
        }

        // Add event listener for bingo visit form
        if (bingoVisitForm) {
            bingoVisitForm.addEventListener('submit', handleBingoVisit);
        }

    } catch (error) {
        console.error('Error initializing Game booth:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 