// main.js
// CHANGE THIS IMPORT LINE:
import { merger } from './pdf.engine.js'; 

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
const statusBar = document.getElementById('statusBar');

let selectedFiles = [];

// Listen to the worker via the engine instance
merger.worker.addEventListener('message', (e) => {
    const { status, message } = e.data;
    if (status === 'loading' || status === 'working') {
        statusBar.innerText = `> SYSTEM: ${message}`;
    } else if (status === 'ready') {
        statusBar.innerText = `> SYSTEM: WORKER READY. WAITING FOR INPUT.`;
        checkReadyState();
    }
});

// ... (Rest of your UI logic: dragover, drop, etc. remains exactly the same) ...

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(fileListObj) {
    const newFiles = Array.from(fileListObj).filter(f => f.type === 'application/pdf');
    selectedFiles = [...selectedFiles, ...newFiles];
    renderFileList();
    checkReadyState();
}

// --- Updated Render Logic ---

let dragStartIndex;

// In main.js

function renderFileList() {
    fileList.innerHTML = ''; // Clear current list

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.classList.add('file-item');
        item.setAttribute('draggable', 'true');
        item.dataset.index = index;

        // --- NEW HTML STRUCTURE ---
        // Note: The onclick lives on the container div for the remove button now
        item.innerHTML = `
            <div class="drag-handle"></div>
            <div class="file-info">
                <span class="file-name">${index + 1}. ${file.name}</span>
                <span class="file-meta">${(file.size/1024/1024).toFixed(2)} MB</span>
            </div>
            <div class="remove-btn" onclick="window.removeFile(${index})" title="Remove file"></div>
        `;
        // ---------------------------


        // --- Drag Events (These are unchanged from previous version) ---
        item.addEventListener('dragstart', (e) => {
            dragStartIndex = +item.dataset.index;
            // Small delay so the element isn't instantly hidden
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
             // Optional: set a custom drag image if you want to get fancy later
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragEndIndex = +item.dataset.index;
            if(dragStartIndex !== dragEndIndex) {
                 item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const dragEndIndex = +item.dataset.index;
            swapItems(dragStartIndex, dragEndIndex);
            item.classList.remove('drag-over');
            item.classList.remove('dragging');
        });

        item.addEventListener('dragend', () => {
             item.classList.remove('dragging');
             item.classList.remove('drag-over');
        });

        fileList.appendChild(item);
    });
    
    checkReadyState();
}

// --- Helper Functions ---

// Global scope so HTML onclick can see it
window.removeFile = (index) => {
    selectedFiles.splice(index, 1);
    renderFileList();
};

function swapItems(fromIndex, toIndex) {
    const itemToMove = selectedFiles[fromIndex];
    
    // Remove from old position
    selectedFiles.splice(fromIndex, 1);
    
    // Insert at new position
    selectedFiles.splice(toIndex, 0, itemToMove);
    
    renderFileList();
}

function checkReadyState() {
    const isWorkerReady = statusBar.innerText.includes("READY") || statusBar.innerText.includes("WAITING");
    
    if (selectedFiles.length >= 2 && isWorkerReady) {
        mergeBtn.innerText = "MERGE_PDFS()";
        mergeBtn.classList.add('ready');
    } else if (selectedFiles.length < 2) {
        mergeBtn.innerText = "ADD AT LEAST 2 FILES";
        mergeBtn.classList.remove('ready');
    }
}

mergeBtn.addEventListener('click', async () => {
    if (!mergeBtn.classList.contains('ready')) return;

    mergeBtn.innerText = "PROCESSING...";
    mergeBtn.classList.remove('ready');
    
    try {
        await merger.mergeFiles(selectedFiles);
        mergeBtn.innerText = "MERGE COMPLETE";
        setTimeout(checkReadyState, 2000);
    } catch (err) {
        statusBar.innerText = `> ERROR: ${err}`;
    }

});

