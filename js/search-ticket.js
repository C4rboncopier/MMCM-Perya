import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize DOM elements
let searchForm, messageDiv, loadingText, ticketNumberInput,
    ticketDetails, detailNumber, detailStatus, detailState,
    detailPoints, detailClaim, detailUsedAt, detailBooth, backBtn;

// Function to pad ticket number to 5 digits
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to show loading state
function setLoading(isLoading) {
    if (!loadingText) return;
    
    loadingText.classList.toggle('visible', isLoading);
    if (searchForm) {
        const submitButton = searchForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = isLoading;
        if (ticketNumberInput) ticketNumberInput.disabled = isLoading;
    }
}

// Function to show message
function showMessage(text, type = 'error') {
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Function to update ticket details in UI
function updateTicketDetails(ticketData, ticketNumber, isSpecialTicket = false) {
    detailNumber.textContent = ticketNumber + (isSpecialTicket ? ' (Special Ticket)' : '');
    detailStatus.textContent = ticketData.status || 'N/A';
    detailState.textContent = ticketData.state || 'N/A';
    detailPoints.textContent = ticketData.points || '0';
    detailClaim.textContent = ticketData.claim || 'Unclaimed';
    detailUsedAt.textContent = ticketData.usedAt ? new Date(ticketData.usedAt.toDate()).toLocaleString() : 'N/A';
    detailBooth.textContent = ticketData.booth || 'N/A';

    // Show ticket details section
    ticketDetails.style.display = 'block';
}

// Function to handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    let ticketNumber = ticketNumberInput.value.trim();
    
    // Show loading state
    setLoading(true);
    
    try {
        // Validate that input is a number
        if (!/^\d+$/.test(ticketNumber)) {
            showMessage('Please enter a valid ticket number', 'error');
            setLoading(false);
            return;
        }

        ticketNumber = padTicketNumber(ticketNumber);
        let ticketData;
        let isSpecialTicket = false;

        // First check if it's a special ticket (starts with 9)
        if (ticketNumber.startsWith('9')) {
            const specialTicketRef = doc(db, 'specialTickets', ticketNumber);
            const specialTicketSnap = await getDoc(specialTicketRef);
            
            if (specialTicketSnap.exists()) {
                ticketData = specialTicketSnap.data();
                isSpecialTicket = true;
            }
        }

        // If not found in special tickets, check regular tickets
        if (!ticketData) {
            const regularTicketRef = doc(db, 'tickets', ticketNumber);
            const regularTicketSnap = await getDoc(regularTicketRef);

            if (regularTicketSnap.exists()) {
                ticketData = regularTicketSnap.data();
            }
        }

        // If ticket is not found in either collection
        if (!ticketData) {
            showMessage('Ticket not found in any collection!', 'error');
            ticketDetails.style.display = 'none';
            setLoading(false);
            ticketNumberInput.value = '';
            ticketNumberInput.focus();
            return;
        }

        // Update UI with ticket details
        updateTicketDetails(ticketData, ticketNumber, isSpecialTicket);
        showMessage(`${isSpecialTicket ? 'Special ticket' : 'Ticket'} found!`, 'success');
        
        ticketNumberInput.value = '';
        ticketNumberInput.focus();
    } catch (error) {
        console.error('Error searching ticket:', error);
        showMessage('Error searching ticket!', 'error');
        ticketDetails.style.display = 'none';
    } finally {
        setLoading(false);
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize DOM elements
        searchForm = document.getElementById('searchForm');
        messageDiv = document.getElementById('message');
        loadingText = document.querySelector('.loading-text');
        ticketNumberInput = document.getElementById('ticketNumber');
        ticketDetails = document.getElementById('ticketDetails');
        detailNumber = document.getElementById('detailNumber');
        detailStatus = document.getElementById('detailStatus');
        detailState = document.getElementById('detailState');
        detailPoints = document.getElementById('detailPoints');
        detailClaim = document.getElementById('detailClaim');
        detailUsedAt = document.getElementById('detailUsedAt');
        detailBooth = document.getElementById('detailBooth');
        backBtn = document.getElementById('backBtn');

        // Add form submission handler
        if (searchForm) {
            searchForm.addEventListener('submit', handleSearch);
        }

        // Add back button handler
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }

    } catch (error) {
        console.error('Error initializing search ticket:', error);
        showMessage('Error initializing the application', 'error');
    }
}); 