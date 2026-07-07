# OPTISCANN - Vision Screening Application

OPTISCANN is a professional AI-powered vision screening application built with React, Express, and Google Gemini.

## Local Setup Instructions (VS Code)

To run this project locally on your machine, follow these steps:

### 1. Prerequisites
- **Node.js**: Ensure you have Node.js (v18 or higher) installed.
- **Build Tools**: `better-sqlite3` requires C++ build tools.
  - **Windows**: Install "Desktop development with C++" from Visual Studio Installer.
  - **macOS**: Install Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: Install `build-essential`.

### 2. Installation
1. Clone or download the project files.
2. Open the project folder in VS Code.
3. Open a terminal and run:
   ```bash
   npm install
   ```

### 3. Environment Configuration
1. Create a file named `.env` in the root directory.
2. Add your Google Gemini API key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey)):
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### 4. Running the App
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:3000`.

## Features
- **AI Vision Analysis**: Uses Gemini 3.1 Pro for detailed eye screening.
- **3-Phase Capture**: Whole face, focused eyes, and close-up capture.
- **Interactive Dashboard**: Track vision trends (SPH, CYL, Dryness) over time.
- **PDF Reports**: Generate and download professional clinical reports.
- **Multi-Profile Support**: Manage eye health for family members.
- **AI Chatbot**: Specialized assistant for eye health queries.

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Framer Motion, Recharts.
- **Backend**: Node.js, Express, SQLite (better-sqlite3).
- **AI**: Google Gemini API (@google/genai).
- **Vision**: TensorFlow.js (Face Landmarks Detection).
