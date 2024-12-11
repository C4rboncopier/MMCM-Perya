import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Function to get today's date range
function getTodayDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: today, end: tomorrow };
}

// Function to get game booth data
async function getGameBoothData() {
    const gameBoothsData = [];
    const gameBoothsRef = collection(db, 'gameBooths');
    const gameBoothsSnap = await getDocs(gameBoothsRef);
    
    for (const doc of gameBoothsSnap.docs) {
        const data = doc.data();
        gameBoothsData.push({
            boothName: data.boothName || doc.id,
            totalTickets: data.totalTickets || 0
        });
    }
    
    // Sort by totalTickets in descending order
    gameBoothsData.sort((a, b) => b.totalTickets - a.totalTickets);
    
    return gameBoothsData;
}

// Function to get system data
async function getSystemData() {
    const systemRef = doc(db, 'system', 'settings');
    const systemSnap = await getDoc(systemRef);
    const data = systemSnap.exists() ? systemSnap.data() : { freeTicketsCounter: 0 };
    return data.freeTicketsCounter || 0;
}

// Function to count tickets for today
async function getTicketsCount() {
    const { start, end } = getTodayDateRange();
    const ticketsRef = collection(db, 'tickets');
    const ticketsQuery = query(ticketsRef, 
        where('createdAt', '>=', start),
        where('createdAt', '<', end)
    );
    const ticketsSnap = await getDocs(ticketsQuery);
    return ticketsSnap.size;
}

// Function to count all tickets
async function getAllTicketsCount() {
    const ticketsRef = collection(db, 'tickets');
    const ticketsSnap = await getDocs(ticketsRef);
    return ticketsSnap.size;
}

// Function to get bingo cards data
async function getBingoCardsData() {
    const bingoCardsRef = collection(db, 'bingoCards');
    const bingoCardsSnap = await getDocs(bingoCardsRef);
    
    let totalCards = 0;
    let totalRaffleEntries = 0;
    let totalFreeTickets = 0;
    
    console.log('Total documents found:', bingoCardsSnap.size);
    
    bingoCardsSnap.forEach(doc => {
        totalCards++;
        const data = doc.data();
        console.log('Processing bingo card:', doc.id);
        console.log('Card data:', data);
        
        // Count raffle entries (2 per bingo card if not 'None')
        if (data.raffleEntries && data.raffleEntries !== 'None') {
            totalRaffleEntries += 2; // Always 2 raffle entries per qualifying card
            console.log(`Added 2 raffle entries for card ${doc.id}. Total now: ${totalRaffleEntries}`);
        }
        
        // Count free tickets (if not 'Unclaimed')
        if (data.freeTicket && data.freeTicket !== 'Unclaimed') {
            totalFreeTickets++;
            console.log(`Counted free ticket for card ${doc.id}. Total now: ${totalFreeTickets}`);
        }
    });
    
    console.log('Final counts:', {
        totalCards,
        totalRaffleEntries,
        totalFreeTickets
    });
    
    return { totalCards, totalRaffleEntries, totalFreeTickets };
}

// Function to format date for filename
function getFormattedDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to create and show popup
function showPopup(message, isConfirm = false) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
        width: 90%;
    `;

    // Add message
    const messageElement = document.createElement('p');
    messageElement.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 16px;
        color: #333;
    `;
    messageElement.textContent = message;
    popup.appendChild(messageElement);

    // Create loading spinner (hidden by default)
    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.cssText = `
        display: none;
        width: 40px;
        height: 40px;
        margin: 0 auto 20px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #4CAF50;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styleSheet);
    popup.appendChild(loadingSpinner);

    // Add buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 10px;
    `;

    // Create button style
    const buttonStyle = `
        padding: 8px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    `;

    return new Promise((resolve) => {
        if (isConfirm) {
            // Add Yes button
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.style.cssText = buttonStyle + `
                background: #4CAF50;
                color: white;
            `;
            yesButton.onmouseover = () => yesButton.style.backgroundColor = '#45a049';
            yesButton.onmouseout = () => yesButton.style.backgroundColor = '#4CAF50';
            yesButton.onclick = () => {
                // Show loading spinner and hide buttons
                loadingSpinner.style.display = 'block';
                buttonsContainer.style.display = 'none';
                messageElement.textContent = 'Exporting data...';
                resolve(true);
            };

            // Add No button
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.style.cssText = buttonStyle + `
                background: #f44336;
                color: white;
            `;
            noButton.onmouseover = () => noButton.style.backgroundColor = '#da190b';
            noButton.onmouseout = () => noButton.style.backgroundColor = '#f44336';
            noButton.onclick = () => {
                document.body.removeChild(overlay);
                resolve(false);
            };

            buttonsContainer.appendChild(yesButton);
            buttonsContainer.appendChild(noButton);
        } else {
            // Add OK button
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.style.cssText = buttonStyle + `
                background: #4CAF50;
                color: white;
            `;
            okButton.onmouseover = () => okButton.style.backgroundColor = '#45a049';
            okButton.onmouseout = () => okButton.style.backgroundColor = '#4CAF50';
            okButton.onclick = () => {
                document.body.removeChild(overlay);
                resolve(true);
            };
            buttonsContainer.appendChild(okButton);
        }

        popup.appendChild(buttonsContainer);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    });
}

// Function to generate and download PDF
async function generatePDF() {
    try {
        // Create new jsPDF instance
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set initial y position
        let y = 20;
        
        // Add title with formatted date
        doc.setFontSize(16);
        doc.text('Daily Report - ' + new Date().toLocaleDateString(), 20, y);
        y += 10;
        
        // Add game booth data
        doc.setFontSize(14);
        doc.text('Game Booth Data:', 20, y);
        y += 10;
        
        const gameBoothData = await getGameBoothData();
        doc.setFontSize(12);
        for (const booth of gameBoothData) {
            // Check if we need a new page
            if (y > 250) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${booth.boothName}: ${booth.totalTickets} tickets`, 30, y);
            y += 10;
        }
        y += 10;
        
        // Check if we need a new page
        if (y > 220) {
            doc.addPage();
            y = 20;
        }
        
        // Add tickets data
        doc.setFontSize(14);
        doc.text('Tickets Data:', 20, y);
        y += 10;
        
        const todayTicketsCount = await getTicketsCount();
        const allTicketsCount = await getAllTicketsCount();
        doc.setFontSize(12);
        doc.text(`Total Tickets Today: ${todayTicketsCount}`, 30, y);
        y += 10;
        doc.text(`Total Tickets Overall: ${allTicketsCount}`, 30, y);
        y += 20;
        
        // Check if we need a new page
        if (y > 220) {
            doc.addPage();
            y = 20;
        }
        
        // Add bingo cards data
        doc.setFontSize(14);
        doc.text('Bingo Cards Data:', 20, y);
        y += 10;
        
        const bingoData = await getBingoCardsData();
        doc.setFontSize(12);
        doc.text(`Total Bingo Cards: ${bingoData.totalCards}`, 30, y);
        y += 10;
        doc.text(`Total Free Tickets Claimed: ${bingoData.totalFreeTickets}`, 30, y);
        y += 10;
        doc.text(`Total Raffle Entries: ${bingoData.totalRaffleEntries}`, 30, y);
        
        // Save the PDF with date in filename
        const dateStr = getFormattedDate();
        doc.save(`daily-report-${dateStr}.pdf`);
        
        return true;
    } catch (error) {
        console.error('Error generating PDF:', error);
        return false;
    }
}

// Export the main function
export async function handleExportData() {
    const confirmed = await showPopup('Do you want to export today\'s data?', true);
    if (confirmed) {
        const success = await generatePDF();
        // Remove any existing overlays before showing the result
        const existingOverlay = document.querySelector('div[style*="position: fixed"]');
        if (existingOverlay) {
            document.body.removeChild(existingOverlay);
        }
        if (success) {
            await showPopup('Data exported successfully!');
        } else {
            await showPopup('Error exporting data. Please try again.');
        }
    }
} 