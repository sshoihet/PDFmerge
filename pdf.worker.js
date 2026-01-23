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
    // Inside the `pythonCode` string variable in pdf.worker.js:

    const pythonCode = `
    import io
    import zipfile  # <--- NEW STANDARD LIBRARY IMPORT
    from pypdf import PdfWriter, PdfReader
    import js
    
    # ... (Keep existing process_pdfs function) ...
    
    def process_split(file_buffer, job_name):
        # Convert JS buffer to Python BytesIO
        input_stream = io.BytesIO(file_buffer.to_py().tobytes())
        reader = PdfReader(input_stream)
        
        # Prepare the ZIP container in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # Iterate over every page
            for i, page in enumerate(reader.pages):
                writer = PdfWriter()
                writer.add_page(page)
                
                # Write page to memory
                page_bytes = io.BytesIO()
                writer.write(page_bytes)
                
                # Add to zip: "jobname_1.pdf"
                filename = f"{job_name}_{i+1}.pdf"
                zf.writestr(filename, page_bytes.getvalue())
                
        return zip_buffer.getvalue()
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

