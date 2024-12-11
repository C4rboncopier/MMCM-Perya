import { db } from './firebase-config.js';
import { collection, doc, setDoc, getDoc, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Initialize DOM elements
const bingoForm = document.getElementById('bingoForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const resultsSection = document.getElementById('resultsSection');
const bingoCardInfo = document.getElementById('bingoCardInfo');
const backBtn = document.getElementById('backBtn');
const backToBoothBtn = document.getElementById('backToBoothBtn');
const messageDiv = document.getElementById('message');
const loadingText = document.querySelector('.loading-text');

// Function to pad bingo number
function padBingoNumber(number) {
    return 'B' + number.toString().padStart(4, '0');
}

// Function to show message
function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'message';
    }, 3000);
}

// Function to set loading state
function setLoading(isLoading) {
    loadingText.classList.toggle('visible', isLoading);
    const submitBtn = bingoForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = isLoading;
    }
}

// Function to get the next bingo number
async function getNextBingoNumber() {
    try {
        // Query the last bingo card to get the highest number
        const bingoCardsRef = collection(db, 'bingoCards');
        const q = query(bingoCardsRef, orderBy('number', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return 1; // Start from 1 if no cards exist
        }
        
        const lastCard = querySnapshot.docs[0].data();
        const lastNumber = parseInt(lastCard.number.substring(1)); // Remove 'B' prefix
        return lastNumber + 1;
    } catch (error) {
        console.error('Error getting next bingo number:', error);
        throw error;
    }
}

// Function to capitalize first letter of each word
function capitalizeWords(str) {
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Function to handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const name = capitalizeWords(nameInput.value.trim());
    const email = emailInput.value.trim();
    
    // Validate email format
    if (!email.endsWith('@mcm.edu.ph')) {
        showMessage('Email must end with @mcm.edu.ph', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        // Check if email already has a bingo card
        const emailQuery = query(collection(db, 'bingoCards'), orderBy('email'));
        const querySnapshot = await getDocs(emailQuery);
        const existingCard = querySnapshot.docs.find(doc => doc.data().email === email);
        
        if (existingCard) {
            showMessage('This email already has a bingo card!', 'error');
            setLoading(false);
            return;
        }
        
        // Get next bingo number
        const nextNumber = await getNextBingoNumber();
        const bingoNumber = padBingoNumber(nextNumber);
        
        // Create new bingo card document
        const bingoCardRef = doc(db, 'bingoCards', bingoNumber);
        await setDoc(bingoCardRef, {
            number: bingoNumber,
            name: name,
            email: email,
            createdAt: new Date(),
            status: 'Active',
            boothVisits: 0,
            visitedBooths: [],
            freeTicket: 'Unclaimed',
            raffleEntries: 'None',
            bonusPoints: 'None'
        });
        
        // Show results
        bingoCardInfo.innerHTML = `
            <h3>Bingo Card Generated Successfully!</h3>
            <p>Name: ${name}</p>
            <p>Email: ${email}</p>
            <div class="bingo-number">${bingoNumber}</div>
        `;
        
        bingoForm.style.display = 'none';
        resultsSection.style.display = 'block';
        
        // Clear form
        bingoForm.reset();
        
    } catch (error) {
        console.error('Error generating bingo card:', error);
        showMessage('Error generating bingo card. Please try again.', 'error');
    } finally {
        setLoading(false);
    }
}

// Event Listeners
bingoForm.addEventListener('submit', handleSubmit);

backBtn.addEventListener('click', () => {
    bingoForm.style.display = 'block';
    resultsSection.style.display = 'none';
});

backToBoothBtn.addEventListener('click', () => {
    window.location.href = 'ticket-booth.html';
});

// Add email validation
emailInput.addEventListener('input', () => {
    if (emailInput.value && !emailInput.value.endsWith('@mcm.edu.ph')) {
        emailInput.setCustomValidity('Email must end with @mcm.edu.ph');
    } else {
        emailInput.setCustomValidity('');
    }
});

// Add input event listener to capitalize name as user types
if (nameInput) {
    nameInput.addEventListener('input', function(e) {
        const cursorPosition = this.selectionStart;
        const value = this.value;
        this.value = capitalizeWords(value);
        // Restore cursor position
        this.setSelectionRange(cursorPosition, cursorPosition);
    });
} 