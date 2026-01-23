// pdf.engine.js
// The Singleton that bridges UI and Worker

class PDFMerger {
    constructor() {
        this.worker = new Worker('./pdf.worker.js');
        
        // GLOBAL ERROR HANDLER
        this.worker.onerror = (e) => {
            console.error("Worker Error:", e);
            alert("Critical Worker Error. See console.");
        };

        // MESSAGE ROUTER
        this.worker.onmessage = (e) => {
            // We destructure 'filename' here so Splits save as .zip and Merges as .pdf
            const { status, result, error, message, filename } = e.data;
            
            if (status === 'complete') {
                 // Trigger Download
                 // Default to "merged.pdf" if no filename provided by worker
                 this.downloadBlob(result, filename || "merged_document.pdf");
            } 
            // We don't block for 'loading'/'working' here. 
            // We let the UI (main.js) listen to those events directly.
        };
    }

    // --- COMMAND 1: MERGE ---
    async mergeFiles(fileList) {
        const buffers = await Promise.all(
            Array.from(fileList).map(file => file.arrayBuffer())
        );

        const uint8Arrays = buffers.map(b => new Uint8Array(b));

        // Send to worker
        this.worker.postMessage({ 
            command: 'merge', // Explicit command
            id: Date.now(), 
            files: uint8Arrays 
        }, buffers); // Transfer ownership
    }

    // --- COMMAND 2: SPLIT (THE MISSING FUNCTION) ---
    async splitPDF(file, jobName) {
        if (!file) {
            console.error("SplitPDF: No file provided");
            return;
        }

        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        // Send to worker
        this.worker.postMessage({ 
            command: 'split',
            id: Date.now(), 
            file: uint8Array,
            jobName: jobName || "split_doc" 
        }, [buffer]); // Transfer ownership
    }

    // --- UTILITIES ---
    downloadBlob(uint8Array, filename) {
        // Auto-detect MIME type based on extension
        const type = filename.endsWith('.zip') ? "application/zip" : "application/pdf";
        
        const blob = new Blob([uint8Array], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export const merger = new PDFMerger();
