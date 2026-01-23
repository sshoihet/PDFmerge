// comment to force update
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
let appMode = 'MERGE'; // Default State
let dragStartIndex;

// --- INITIALIZATION ---
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

// --- MODE SWITCHING LOGIC ---
function setMode(mode) {
    appMode = mode;
    selectedFiles = []; // Clear files on switch to safety
    renderFileList();
    
    if (mode === 'SPLIT') {
        btnModeSplit.classList.add('active');
        btnModeMerge.classList.remove('active');
        splitControls.style.display = 'block';
        mergeBtn.innerText = "SELECT A PDF";
    } else {
        btnModeMerge.classList.add('active');
        btnModeSplit.classList.remove('active');
        splitControls.style.display = 'none';
        mergeBtn.innerText = "ADD FILES";
    }
    checkReadyState();
}

btnModeMerge.onclick = () => setMode('MERGE');
btnModeSplit.onclick = () => setMode('SPLIT');

// --- DRAG & DROP UI LOGIC ---

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
    
    if (appMode === 'SPLIT') {
        // Split mode only allows ONE file. Overwrite logic.
        selectedFiles = [newFiles[0]];
    } else {
        // Merge mode appends files
        selectedFiles = [...selectedFiles, ...newFiles];
    }
    
    renderFileList();
}

function renderFileList() {
    fileList.innerHTML = ''; 

    selectedFiles.forEach((file, index) => {
        if (!file) return; // Safety check

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

        // Drag Events
        item.addEventListener('dragstart', (e) => {
            dragStartIndex = +item.dataset.index;
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragEndIndex = +item.dataset.index;
            if(dragStartIndex !== dragEndIndex) {
                 item.classList.add('drag-over');
            }
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

// --- HELPERS ---
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

function checkReadyState() {
    const isWorkerReady = statusBar.innerText.includes("READY") || statusBar.innerText.includes("WAITING");
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
mergeBtn.addEventListener('click', async () => {
    if (!mergeBtn.classList.contains('ready')) return;

    mergeBtn.innerText = "PROCESSING...";
    mergeBtn.classList.remove('ready');
    
    try {
        if (appMode === 'MERGE') {
            await merger.mergeFiles(selectedFiles);
        } else {
            const jobName = jobNameInput.value.trim() || "split_files";
            await merger.splitPDF(selectedFiles[0], jobName);
        }
        
        mergeBtn.innerText = "OPERATION COMPLETE";
        setTimeout(checkReadyState, 2000);
    } catch (err) {
        statusBar.innerText = `> ERROR: ${err}`;
        console.error(err);
    }
});

