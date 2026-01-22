// pdf.engine.js
// This creates the singleton that talks to the background worker

class PDFMerger {
    constructor() {
        this.worker = new Worker('./pdf.worker.js');
        this.callbacks = new Map();
        
        // Global error handler for the worker
        this.worker.onerror = (e) => {
            console.error("Worker Error:", e);
            // Dispatch a custom event or handled via the message listener below
        };

        this.worker.onmessage = (e) => {
            const { status, result, error, message } = e.data;
            
            if (status === 'complete') {
                 this.downloadBlob(result, "merged_document.pdf");
            } else if (status === 'error') {
                console.error("Critical Worker Error:", error);
                alert("Merge Failed: " + error);
            }
            // We don't block here for 'loading' status, we let the UI listener handle it
        };
    }

    async mergeFiles(fileList) {
        const buffers = await Promise.all(
            Array.from(fileList).map(file => file.arrayBuffer())
        );

        const uint8Arrays = buffers.map(b => new Uint8Array(b));

        this.worker.postMessage({ 
            id: Date.now(), 
            files: uint8Arrays 
        }, buffers); 
    }

    downloadBlob(uint8Array, filename) {
        const blob = new Blob([uint8Array], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// EXPORT THE SINGLETON
export const merger = new PDFMerger();
