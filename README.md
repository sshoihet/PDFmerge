PDF Tools // Serverless WASM Architecture
A privacy-first, client-side PDF manipulation suite running entirely in the browser via WebAssembly.

Live Demo: https://sshoihet.github.io/PDFtools/

⚡ Overview
PDF Tools is a web-based utility designed to Merge and Split PDF documents without ever uploading them to a server. By leveraging Pyodide (a port of CPython to WebAssembly), this application runs a full Python environment inside your web browser.

Key Advantages:

Zero Latency: No file upload/download roundtrips.

Total Privacy: Files are processed in your browser's memory. No data leaves your machine.

Robustness: Uses the industry-standard pypdf Python library instead of experimental JS parsers.

🛠 Features
Merge Mode:

Drag-and-drop interface.

Visual reordering (drag cards to sort).

Automatic "pypdf" stream merging.

Split Mode:

Extract every page of a PDF into individual files.

Automatic ZIP archiving (downloads as JobName.zip to prevent popup blocking).

Engineer UI:

Dark mode aesthetic.

Real-time system status logging.

Web Worker integration to prevent UI freezing during heavy processing.

🏗 Architecture
The application uses a Thread-Offloading Architecture to ensure the UI remains responsive, even when processing large blueprints.

🚀 Quick Start (Local Development)
Since this project relies on Web Workers and WASM, it cannot be run directly from the file system (file://). It requires a local web server.

Prerequisites
Python 3.x (or any simple HTTP server)

Installation
Clone the repository:

Bash
git clone https://github.com/yourusername/pdf-tools.git
cd pdf-tools
Start a local server:

# Python 3
python -m http.server 8000
Launch: Open http://localhost:8000 in your browser.

📦 Deployment
This project is optimized for GitHub Pages.

Push your code to a GitHub repository.

Go to Settings > Pages.

Select main branch as the source.

GitHub Actions will build and deploy the static site automatically.

🔧 Technology Stack
Frontend: HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript (ES6+).

Runtime: Pyodide (Python 3.11 in WASM).

Python Libraries: pypdf, zipfile, io.

Concurrency: HTML5 Web Workers.

📄 License
Distributed under the MIT License. See LICENSE for more information.
