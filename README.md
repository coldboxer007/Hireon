# AI Interview Prep Platform

A modern, AI-powered interview preparation application that helps candidates practice, refine, and analyze their interview skills using Google's advanced Gemini models.

## ✨ Key Features

*   **📄 Flexible Input Options:** Upload your resume (PDF) and provide job descriptions either via PDF upload or direct text paste.
*   **⚡ Optimized Research & Prep:** Generates tailored interview questions and company research by running AI analysis and web searches in parallel for maximum speed.
*   **🎙️ Live Mock Interviews:** Experience real-time voice conversations with an AI interviewer powered by the Gemini Live API (`gemini-2.5-flash-native-audio-preview`).
*   **🎥 Smart Video Processing:** Features real-time video compression using a hidden canvas to ensure seamless post-interview analysis without hitting file size limits.
*   **📝 Accurate Transcription:** Captures both user and AI speech in real-time, providing a complete and accurate transcript of your mock interview.
*   **📊 Deep Analysis & Visualizations:** Uses `gemini-3.1-pro-preview` to analyze your body language, tone, and answers. Feedback is visualized using sleek, neon-blue Radar Charts for skills analysis.
*   **🎨 Modern UI/UX:** Features a dark, atmospheric glassmorphism design with neon blue accents and smooth animations.

## 🛠️ Tech Stack

*   **Frontend Framework:** React 18 with TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS
*   **Animations:** Framer Motion
*   **Data Visualization:** Recharts
*   **Icons:** Lucide React
*   **AI Integration:** Google GenAI SDK (`@google/genai`)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   A Google Gemini API Key

### Installation

1.  Clone the repository and navigate to the project directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the root directory and add your Gemini API key:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```
    *(Note: If running in the AI Studio environment, the key is automatically provided via `process.env.GEMINI_API_KEY`)*

4.  Start the development server:
    ```bash
    npm run dev
    ```

## 💡 How It Works

1.  **Input:** Start by providing your resume and the job description you are targeting.
2.  **Prep Pack:** The app generates a custom preparation package, including company research, tailored questions, and a skills radar chart.
3.  **Mock Interview:** Engage in a live, two-way audio/video interview with the AI. The app records and compresses your video while transcribing the conversation.
4.  **Analysis:** Once finished, the app analyzes the compressed video and transcript to provide actionable feedback on your performance, communication skills, and body language.
