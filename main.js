import { merger } from './pdf.engine.js'; 

// --- DOM ELEMENTS ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
const statusBar = document.getElementById('statusBar');

// Mode Controls
const btnModeMerge = document.getElementById('btnModeMerge');
const btnModeSplit = document.getElementById('btnModeSplit');
const splitControls = document.getElementById('splitControls');
const jobNameInput = document.getElementById('jobNameInput');

// --- STATE ---
let selectedFiles = [];
let appMode = 'MERGE';
let dragStartIndex;

// --- WORKER EVENT LISTENER ---
merger.worker.addEventListener('message', (e) => {
    const { status, message } = e.data;
    
    if (status === 'loading' || status === 'working') {
        statusBar.innerText = `> SYSTEM: ${message}`;
        statusBar.style.color = '#58a6ff'; // Blue
    } 
    else if (status === 'ready') {
        statusBar.innerText = `> SYSTEM: WORKER READY. WAITING FOR INPUT.`;
        statusBar.style.color = '#58a6ff';
        checkReadyState();
    }
    else if (status === 'complete') {
        // --- SUCCESS & AUTO-RESET ---
        statusBar.innerText = `> SYSTEM: OPERATION SUCCESSFUL. INITIATING DOWNLOAD.`;
        statusBar.style.color = '#238636'; // Green
        
        mergeBtn.innerText = "DOWNLOAD STARTED";
        
        // Wait 3 seconds, then wipe everything clean
        setTimeout(() => {
            selectedFiles = []; // Clear Data
            renderFileList();   // Clear UI
            statusBar.innerText = `> SYSTEM: READY FOR NEXT JOB.`;
            statusBar.style.color = '#58a6ff';
            checkReadyState();  // Reset Button
        }, 3000);
    }
    else if (status === 'error') {
        statusBar.innerText = `> ERROR: ${e.data.error}`;
        statusBar.style.color = '#f85149'; // Red
        mergeBtn.innerText = "ERROR - RETRY?";
        checkReadyState();
    }
});

// --- MODE SWITCHING ---
function setMode(mode) {
    appMode = mode;
    selectedFiles = [];
    renderFileList();
    
    if (mode === 'SPLIT') {
        btnModeSplit.classList.add('active');
        btnModeMerge.classList.remove('active');
        splitControls.style.display = 'block';
    } else {
        btnModeMerge.classList.add('active');
        btnModeSplit.classList.remove('active');
        splitControls.style.display = 'none';
    }
    checkReadyState();
}

btnModeMerge.onclick = () => setMode('MERGE');
btnModeSplit.onclick = () => setMode('SPLIT');

// --- FILE HANDLING ---
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

function handleFiles(fileListObj) {
    const newFiles = Array.from(fileListObj).filter(f => f.type === 'application/pdf');
    
    if (appMode === 'SPLIT') {
        selectedFiles = [newFiles[0]];
    } else {
        selectedFiles = [...selectedFiles, ...newFiles];
    }
    renderFileList();
}

// --- RENDER & DRAG-DROP LOGIC ---
function renderFileList() {
    fileList.innerHTML = ''; 

    selectedFiles.forEach((file, index) => {
        if (!file) return;

        const item = document.createElement('div');
        item.classList.add('file-item');
        item.setAttribute('draggable', 'true');
        item.dataset.index = index;

        item.innerHTML = `
            <div class="drag-handle"></div>
            <div class="file-info">
                <span class="file-name">${index + 1}. ${file.name}</span>
                <span class="file-meta">${(file.size/1024/1024).toFixed(2)} MB</span>
            </div>
            <div class="remove-btn" onclick="window.removeFile(${index})" title="Remove file"></div>
        `;

        // Drag Handlers
        item.addEventListener('dragstart', (e) => {
            dragStartIndex = +item.dataset.index;
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragEndIndex = +item.dataset.index;
            if(dragStartIndex !== dragEndIndex) item.classList.add('drag-over');
        });

        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

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

window.removeFile = (index) => {
    selectedFiles.splice(index, 1);
    renderFileList();
};

function swapItems(fromIndex, toIndex) {
    const itemToMove = selectedFiles[fromIndex];
    selectedFiles.splice(fromIndex, 1);
    selectedFiles.splice(toIndex, 0, itemToMove);
    renderFileList();
}

// --- BUTTON STATE ---
function checkReadyState() {
    const isWorkerReady = statusBar.innerText.includes("READY") || statusBar.innerText.includes("WAITING") || statusBar.innerText.includes("SUCCESS") || statusBar.innerText.includes("NEXT JOB");
    let isReady = false;

    if (appMode === 'MERGE') {
        isReady = selectedFiles.length >= 2 && isWorkerReady;
        if (isReady) mergeBtn.innerText = "MERGE_PDFS()";
        else mergeBtn.innerText = "ADD AT LEAST 2 FILES";
    } else {
        isReady = selectedFiles.length === 1 && isWorkerReady;
        if (isReady) mergeBtn.innerText = "SPLIT PDF";
        else mergeBtn.innerText = "SELECT SINGLE PDF";
    }

    if (isReady) mergeBtn.classList.add('ready');
    else mergeBtn.classList.remove('ready');
}

// --- EXECUTION ---
mergeBtn.addEventListener('click', () => {
    if (!mergeBtn.classList.contains('ready')) return;

    mergeBtn.innerText = "PROCESSING...";
    mergeBtn.classList.remove('ready');
    
    if (appMode === 'MERGE') {
        merger.mergeFiles(selectedFiles);
    } else {
        const jobName = jobNameInput.value.trim() || "split_files";
        merger.splitPDF(selectedFiles[0], jobName);
    }
});
