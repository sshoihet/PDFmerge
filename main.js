import { merger } from './main.js'; // Assuming the class is exported

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
const statusBar = document.getElementById('statusBar');

let selectedFiles = [];

// --- Worker Status Hooks ---
merger.worker.addEventListener('message', (e) => {
    const { status, message } = e.data;
    if (status === 'loading' || status === 'working') {
        statusBar.innerText = `> SYSTEM: ${message}`;
    } else if (status === 'ready') {
        statusBar.innerText = `> SYSTEM: WORKER READY. WAITING FOR INPUT.`;
        checkReadyState();
    }
});

// --- Drag & Drop Logic ---
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

function renderFileList() {
    fileList.innerHTML = selectedFiles
        .map((f, i) => `[${i}] ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`)
        .join('<br>');
}

function checkReadyState() {
    // Only enable button if Worker is ready AND files are selected
    const isWorkerReady = statusBar.innerText.includes("READY") || statusBar.innerText.includes("WAITING");
    
    if (selectedFiles.length >= 2 && isWorkerReady) {
        mergeBtn.innerText = "MERGE_PDFS()";
        mergeBtn.classList.add('ready');
    } else if (selectedFiles.length < 2) {
        mergeBtn.innerText = "ADD AT LEAST 2 FILES";
        mergeBtn.classList.remove('ready');
    }
}

// --- Execution ---
mergeBtn.addEventListener('click', async () => {
    if (!mergeBtn.classList.contains('ready')) return;

    mergeBtn.innerText = "PROCESSING...";
    mergeBtn.classList.remove('ready'); // Prevent double-click
    
    try {
        await merger.mergeFiles(selectedFiles);
        // Reset after download
        mergeBtn.innerText = "MERGE COMPLETE";
        setTimeout(checkReadyState, 2000);
    } catch (err) {
        statusBar.innerText = `> ERROR: ${err}`;
    }
});