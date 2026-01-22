// pdf.worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodideReadyPromise = null;

async function loadPyodideAndPackages() {
    if (pyodideReadyPromise) return pyodideReadyPromise; // Memoize

    self.postMessage({ status: 'loading', message: 'Booting Python Environment...' });
    
    // 1. Initialize Pyodide
    const pyodide = await loadPyodide();
    
    // 2. Install pypdf (micropip is built-in now)
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    
    self.postMessage({ status: 'loading', message: 'Installing pypdf...' });
    await micropip.install("pypdf");
    
    // 3. Define the Python Merge Logic
    // We define this ONCE to avoid recompiling Python code on every message
    const pythonCode = `
import io
from pypdf import PdfWriter, PdfReader
import js

def process_pdfs(file_buffers):
    merger = PdfWriter()
    
    # Iterate through the JS Proxy object (Array of Uint8Arrays)
    for buffer in file_buffers:
        # 'to_py()' converts JS TypedArray to a Python memory view
        # We wrap it in BytesIO to make it file-like
        pdf_stream = io.BytesIO(buffer.to_py().tobytes())
        merger.append(pdf_stream)

    output = io.BytesIO()
    merger.write(output)
    
    # Get the raw bytes
    result_bytes = output.getvalue()
    return result_bytes
`;
    pyodide.runPython(pythonCode);

    self.postMessage({ status: 'ready', message: 'Ready to Merge' });
    return pyodide;
}

// Start loading immediately
pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async (event) => {
    const pyodide = await pyodideReadyPromise;
    const { id, files } = event.data;

    try {
        self.postMessage({ status: 'working', message: 'Merging PDFs...' });

        // Access the Python function
        const mergerFunction = pyodide.globals.get('process_pdfs');

        // execution
        const mergedPdfBytes = mergerFunction(files);
        
        // Convert Python bytes back to JS Uint8Array
        // .toJs() creates a copy, which is necessary to transfer ownership back to main thread
        const jsArray = mergedPdfBytes.toJs();

        // Cleanup Python objects to free WASM memory
        mergedPdfBytes.destroy(); 
        mergerFunction.destroy();

        // Send back to Main Thread
        // We use Transferable (second argument) to zero-copy move the result
        self.postMessage({ status: 'complete', id, result: jsArray }, [jsArray.buffer]);

    } catch (error) {
        self.postMessage({ status: 'error', error: error.message });
    }
};