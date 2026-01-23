// pdf.worker.js
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodideReadyPromise = null;

async function loadPyodideAndPackages() {
    self.postMessage({ status: 'loading', message: 'Booting Python Environment...' });
    
    // 1. Initialize Pyodide
    const pyodide = await loadPyodide();
    
    // 2. Install Dependencies
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    
    self.postMessage({ status: 'loading', message: 'Installing pypdf...' });
    await micropip.install("pypdf");
    
    // 3. Define the Python Logic (Merge AND Split)
    const pythonCode = `
import io
import zipfile
from pypdf import PdfWriter, PdfReader
import js

# --- FUNCTION 1: MERGE ---
def process_pdfs(file_buffers):
    merger = PdfWriter()
    
    # Iterate through the JS Proxy object (Array of Uint8Arrays)
    for buffer in file_buffers:
        # Convert JS TypedArray to Python BytesIO
        pdf_stream = io.BytesIO(buffer.to_py().tobytes())
        merger.append(pdf_stream)

    output = io.BytesIO()
    merger.write(output)
    return output.getvalue()

# --- FUNCTION 2: SPLIT ---
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
    // Compile the Python code
    pyodide.runPython(pythonCode);

    self.postMessage({ status: 'ready', message: 'Ready to Process' });
    return pyodide;
}

// Start loading immediately with error handling
pyodideReadyPromise = loadPyodideAndPackages().catch(err => {
    self.postMessage({ 
        status: 'error', 
        error: `WORKER BOOT FAILED: ${err.message}` 
    });
});

// --- MESSAGE ROUTER ---
self.onmessage = async (event) => {
    const pyodide = await pyodideReadyPromise;
    // Destructure all possible inputs
    const { id, files, file, command, jobName } = event.data;

    try {
        if (command === 'split') {
            // --- SPLIT MODE ---
            self.postMessage({ status: 'working', message: 'Splitting & Zipping...' });
            
            const splitFunction = pyodide.globals.get('process_split');
            
            // Call Python
            const zipBytes = splitFunction(file, jobName);
            const jsArray = zipBytes.toJs();
            
            zipBytes.destroy();
            splitFunction.destroy();
            
            self.postMessage({ status: 'complete', id, result: jsArray, filename: `${jobName}.zip` }, [jsArray.buffer]);
            
        } else {
            // --- MERGE MODE (Default) ---
            self.postMessage({ status: 'working', message: 'Merging PDFs...' });

            const mergerFunction = pyodide.globals.get('process_pdfs');
            
            // Call Python
            const mergedPdfBytes = mergerFunction(files);
            const jsArray = mergedPdfBytes.toJs();

            mergedPdfBytes.destroy(); 
            mergerFunction.destroy();

            self.postMessage({ status: 'complete', id, result: jsArray }, [jsArray.buffer]);
        }

    } catch (error) {
        self.postMessage({ status: 'error', error: error.message });
    }
};
