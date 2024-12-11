import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { initializeFirebase } from './firebase-config.js';

// Initialize DOM elements
const messageDiv = document.getElementById('message');
const loadingText = document.querySelector('.loading-text');
const rewardsDialog = document.getElementById('rewardsDialog');
const rewardsDetails = document.getElementById('rewardsDetails');
const confirmRewardsBtn = document.getElementById('confirmRewardsBtn');
const freeTicketsCount = document.getElementById('freeTicketsCount');
const bingoCheckForm = document.getElementById('bingoCheckForm');
const bingoNumberInput = document.getElementById('bingoNumber');
const claimRewardsBtn = document.getElementById('claimRewardsBtn');
const backToBoothBtn = document.getElementById('backToBoothBtn');

let currentBingoCard = null;
let pendingRewards = null;
let initializedDb = null;

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
    const submitBtn = bingoCheckForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = isLoading;
    }
}

// Function to check available rewards
function checkAvailableRewards(bingoData) {
    const rewards = [];
    const visitCount = bingoData.boothVisits;

    if (visitCount >= 7 && bingoData.freeTicket === 'Unclaimed') {
        rewards.push({
            type: 'freeTicket',
            description: 'Free Ticket (7 Booths)',
            claimable: true
        });
    }

    if (visitCount >= 14 && bingoData.raffleEntries === 'None') {
        rewards.push({
            type: 'raffleEntries',
            description: '2 Raffle Entries (14 Booths)',
            claimable: true
        });
    }

    if (visitCount >= 21 && bingoData.bonusPoints === 'None') {
        rewards.push({
            type: 'bonusPoints',
            description: 'Bonus Ticket (100 Points) (21 Booths)',
            claimable: true
        });
    }

    return rewards;
}

// Function to display bingo card details
function displayBingoDetails(bingoData) {
    cardInfo.innerHTML = `
        <div class="info-item">
            <p><strong>Card Number:</strong> ${bingoData.number}</p>
            <p><strong>Name:</strong> ${bingoData.name}</p>
            <p><strong>Email:</strong> ${bingoData.email}</p>
            <p><strong>Booths Visited:</strong> ${bingoData.boothVisits} / 21</p>
            <p><strong>Free Ticket:</strong> ${bingoData.freeTicket}</p>
            <p><strong>Raffle Entries:</strong> ${Array.isArray(bingoData.raffleEntries) ? bingoData.raffleEntries.join(', ') : 'None'}</p>
            <p><strong>Bonus Points:</strong> ${bingoData.bonusPoints}</p>
        </div>
    `;

    const rewards = checkAvailableRewards(bingoData);
    
    if (rewards.length > 0) {
        rewardsList.innerHTML = rewards.map(reward => `
            <div class="reward-item">
                <p>${reward.description}</p>
            </div>
        `).join('');
        rewardsSection.style.display = 'block';
        claimRewardsBtn.style.display = 'block';
    } else {
        rewardsSection.style.display = 'none';
        claimRewardsBtn.style.display = 'none';
    }
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

// Function to handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    if (!initializedDb) return;

    const bingoNumber = bingoNumberInput.value.trim().toUpperCase();
    let formattedNumber = bingoNumber;

    // If only numbers are entered, add the 'B' prefix
    if (/^\d+$/.test(bingoNumber)) {
        formattedNumber = 'B' + bingoNumber.padStart(4, '0');
    }

    setLoading(true);
    try {
        const bingoRef = doc(initializedDb, 'bingoCards', formattedNumber);
        const bingoSnap = await getDoc(bingoRef);

        if (!bingoSnap.exists()) {
            showMessage('Bingo card not found!', 'error');
            setLoading(false);
            return;
        }

        currentBingoCard = {
            ref: bingoRef,
            data: bingoSnap.data()
        };

        displayBingoDetails(bingoSnap.data());
    } catch (error) {
        console.error('Error checking bingo card:', error);
        showMessage('Error checking bingo card. Please try again.', 'error');
    } finally {
        setLoading(false);
    }
}

// Function to pad ticket number
function padTicketNumber(number) {
    return number.toString().padStart(5, '0');
}

// Function to get next ticket number
async function getNextTicketNumber() {
    if (!initializedDb) return;
    try {
        // Get the current counter
        const counterRef = doc(initializedDb, 'system', 'ticketCounter');
        const counterSnap = await getDoc(counterRef);
        
        if (!counterSnap.exists()) {
            throw new Error('Ticket counter not found');
        }
        
        const currentCounter = counterSnap.data().currentNumber;
        const nextNumber = currentCounter + 1;
        
        // Update the counter
        await updateDoc(counterRef, {
            currentNumber: nextNumber,
            lastUpdated: serverTimestamp()
        });
        
        return padTicketNumber(nextNumber);
    } catch (error) {
        console.error('Error getting next ticket number:', error);
        throw error;
    }
}

// Function to show rewards dialog
function showRewardsDialog(rewards, bingoData) {
    let detailsHtml = '<div class="reward-item"><p><strong>Bingo Card:</strong> ' + bingoData.number + '</p></div>';
    
    if (rewards.freeTicket) {
        detailsHtml += `
            <div class="reward-item">
                <p><strong>Free Ticket:</strong> ${rewards.freeTicket}</p>
                <p><small>7 Booth Visit Reward</small></p>
            </div>
        `;
    }
    
    if (rewards.raffleEntries) {
        detailsHtml += `
            <div class="reward-item">
                <p><strong>Raffle Entries:</strong> 2</p>
                <p><small>14 Booth Visit Reward</small></p>
            </div>
        `;
    }
    
    if (rewards.bonusTicket) {
        detailsHtml += `
            <div class="reward-item">
                <p><strong>Bonus Ticket:</strong> ${rewards.bonusTicket}</p>
                <p><strong>Points:</strong> 100</p>
                <p><small>21 Booth Visit Reward</small></p>
            </div>
        `;
    }
    
    rewardsDetails.innerHTML = detailsHtml;
    rewardsDialog.style.display = 'flex';
    pendingRewards = rewards;
}

// Function to hide rewards dialog
function hideRewardsDialog() {
    rewardsDialog.style.display = 'none';
    pendingRewards = null;
}

// Function to handle rewards claim
async function handleClaimRewards() {
    if (!currentBingoCard) return;

    const { data } = currentBingoCard;
    const visitCount = data.boothVisits;
    const rewards = {};

    try {
        if (visitCount >= 7 && data.freeTicket === 'Unclaimed') {
            const nextTicketNumber = await getNextTicketNumber();
            rewards.freeTicket = nextTicketNumber;
        }

        if (visitCount >= 14 && data.raffleEntries === 'None') {
            rewards.raffleEntries = true;
        }

        if (visitCount >= 21 && data.bonusPoints === 'None') {
            const bonusTicketNumber = `9${data.number.substring(1)}`;
            rewards.bonusTicket = bonusTicketNumber;
        }

        if (Object.keys(rewards).length > 0) {
            showRewardsDialog(rewards, data);
        } else {
            showMessage('No rewards available to claim', 'info');
        }
    } catch (error) {
        console.error('Error preparing rewards:', error);
        showMessage('Error preparing rewards. Please try again.', 'error');
    }
}

// Function to update free tickets counter display
async function updateFreeTicketsDisplay() {
    if (!initializedDb) return;
    try {
        const counterRef = doc(initializedDb, 'system', 'freeTicketsCounter');
        const counterSnap = await getDoc(counterRef);
        
        if (counterSnap.exists()) {
            freeTicketsCount.textContent = counterSnap.data().total;
        } else {
            freeTicketsCount.textContent = '0';
        }
    } catch (error) {
        console.error('Error getting free tickets count:', error);
        freeTicketsCount.textContent = 'Error';
    }
}

// Function to increment free tickets counter
async function incrementFreeTicketsCounter() {
    if (!initializedDb) return;
    try {
        const counterRef = doc(initializedDb, 'system', 'freeTicketsCounter');
        const counterSnap = await getDoc(counterRef);
        
        if (!counterSnap.exists()) {
            // Initialize counter if it doesn't exist
            await setDoc(counterRef, {
                total: 1,
                lastUpdated: serverTimestamp()
            });
            await updateFreeTicketsDisplay();
            return 1;
        } else {
            const currentTotal = counterSnap.data().total;
            const newTotal = currentTotal + 1;
            
            await updateDoc(counterRef, {
                total: newTotal,
                lastUpdated: serverTimestamp()
            });
            await updateFreeTicketsDisplay();
            return newTotal;
        }
    } catch (error) {
        console.error('Error updating free tickets counter:', error);
        throw error;
    }
}

// Function to generate raffle ticket number
async function generateRaffleTicketNumber() {
    if (!initializedDb) return;
    try {
        const counterRef = doc(initializedDb, 'system', 'raffleTicketCounter');
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

// Function to process confirmed rewards
async function processRewards() {
    if (!pendingRewards || !currentBingoCard || !initializedDb) return;

    setLoading(true);
    try {
        const { ref, data } = currentBingoCard;
        const updates = {};

        if (pendingRewards.freeTicket) {
            const ticketRef = doc(initializedDb, 'tickets', pendingRewards.freeTicket);
            await setDoc(ticketRef, {
                status: 'Released',
                state: 'Unused',
                claim: 'Unclaimed',
                points: 'None',
                booth: 'Bingo Free Ticket',
                createdAt: serverTimestamp(),
                ticketNumber: pendingRewards.freeTicket
            });
            updates.freeTicket = `Claimed - ${pendingRewards.freeTicket}`;
            
            // Increment free tickets counter
            await incrementFreeTicketsCounter();
        }

        if (pendingRewards.raffleEntries) {
            // Generate 2 raffle tickets
            const raffleTicket1 = await generateRaffleTicketNumber();
            const raffleTicket2 = await generateRaffleTicketNumber();
            
            // Create raffle tickets in Firestore
            const raffleRef1 = doc(initializedDb, 'raffleTickets', raffleTicket1);
            const raffleRef2 = doc(initializedDb, 'raffleTickets', raffleTicket2);
            
            await setDoc(raffleRef1, {
                ticketNumber: raffleTicket1,
                bingoCard: data.number,
                createdAt: serverTimestamp(),
                status: 'Active'
            });
            
            await setDoc(raffleRef2, {
                ticketNumber: raffleTicket2,
                bingoCard: data.number,
                createdAt: serverTimestamp(),
                status: 'Active'
            });
            
            // Store raffle entries as an array
            updates.raffleEntries = [raffleTicket1, raffleTicket2];
        }

        if (pendingRewards.bonusTicket) {
            const ticketRef = doc(initializedDb, 'tickets', pendingRewards.bonusTicket);
            await setDoc(ticketRef, {
                status: 'Released',
                state: 'Unused',
                claim: 'Unclaimed',
                points: 'None',
                booth: 'Bingo Reward',
                createdAt: serverTimestamp(),
                ticketNumber: pendingRewards.bonusTicket
            });
            updates.bonusPoints = `Claimed - ${pendingRewards.bonusTicket}`;
        }

        await updateDoc(ref, {
            ...updates,
            lastUpdated: serverTimestamp()
        });

        // Get updated bingo card data
        const newSnap = await getDoc(ref);
        currentBingoCard.data = newSnap.data();
        displayBingoDetails(currentBingoCard.data);

        // Clear and focus the bingo number input
        bingoNumberInput.value = '';
        bingoNumberInput.focus();

    } catch (error) {
        console.error('Error claiming rewards:', error);
        showMessage('Error claiming rewards. Please try again.', 'error');
    } finally {
        setLoading(false);
        hideRewardsDialog();
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase first
        const { db: firebaseDb } = await initializeFirebase();
        initializedDb = firebaseDb;

        // Update free tickets counter display
        await updateFreeTicketsDisplay();
        
        // Set up real-time listener for counter updates
        const counterRef = doc(initializedDb, 'system', 'freeTicketsCounter');
        onSnapshot(counterRef, (snapshot) => {
            if (snapshot.exists()) {
                freeTicketsCount.textContent = snapshot.data().total;
            }
        });

        // Add event listeners
        if (bingoCheckForm) {
            bingoCheckForm.addEventListener('submit', handleSubmit);
        }
        if (claimRewardsBtn) {
            claimRewardsBtn.addEventListener('click', handleClaimRewards);
        }
        if (confirmRewardsBtn) {
            confirmRewardsBtn.addEventListener('click', processRewards);
        }
        if (backToBoothBtn) {
            backToBoothBtn.addEventListener('click', () => {
                window.location.href = 'prize-booth.html';
            });
        }
    } catch (error) {
        console.error('Error initializing page:', error);
        showMessage('Error initializing page. Please refresh.', 'error');
    }
}); 