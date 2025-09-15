# Sentiscope - AI-Powered Sentiment Analysis Platform

Sentiscope is a comprehensive sentiment analysis platform that analyzes Reddit posts to provide real-time sentiment insights, data visualization, and AI-generated summaries. Built with React, Flask, and machine learning models.

**Note**: Hosting was discontinued due to cost. Project can be run locally with a .env file. **API keys are required and must be requested from the developer for approval.**

## Features

- **Real-time Sentiment Analysis**: Analyze sentiment of Reddit posts using trained ML models
- **Reddit Integration**: Fetch posts from multiple subreddits with time-based filtering
- **Data Visualization**: Interactive charts and graphs showing sentiment distribution
- **AI Summaries**: Generate intelligent summaries using OpenAI GPT models
- **User Authentication**: Secure Firebase-based authentication system
- **Caching**: Redis-powered caching for improved performance
- **Responsive Design**: Mobile-first, modern UI built with React and TypeScript

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Recharts** for data visualization
- **Firebase** for authentication

### Backend
- **Flask** with Python 3.9+
- **Firebase Admin SDK** for authentication
- **Redis** for caching
- **scikit-learn** for ML models
- **NLTK** for text processing
- **OpenAI API** for AI summaries

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Redis server (optional)
- **API Keys (contact developer for approval):**
  - Firebase project with Firestore enabled
  - Reddit API credentials
  - OpenAI API key

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/project-sentiscope.git
cd project-sentiscope
```

### 2. Environment Configuration

**API Keys Required - Contact Developer for Approval**

Create `.env` file in the `backend` directory:
```env
FIREBASE_PRIVATE_KEY_PATH=./privatekey.json
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_SECRET_KEY=your_reddit_secret_key
USER_AGENT=your_app_name/1.0
OPENAI_API_KEY=your_openai_api_key
REDIS_URL=redis://localhost:6379
```

Create `.env` file in the `sentiscope-vite-app` directory:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Backend Setup

**Windows PowerShell:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**macOS/Linux:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 4. Classification Service Setup

**Windows PowerShell:**
```powershell
cd classification
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

**macOS/Linux:**
```bash
cd classification
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```

### 5. Frontend Setup
```bash
cd sentiscope-vite-app
npm install
npm run dev
```

### 6. Running All Services

Run **3 services simultaneously**:

**Terminal 1 - Backend (Port 5000):**
```powershell
cd backend
venv\Scripts\activate
python app.py
```

**Terminal 2 - Classification Service (Port 5001):**
```powershell
cd classification
venv\Scripts\activate
python server.py
```

**Terminal 3 - Frontend (Port 5173):**
```bash
cd sentiscope-vite-app
npm run dev
```

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Classification Service**: http://localhost:5001

## Troubleshooting

**PowerShell Execution Policy Error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Missing Packages:**
```bash
pip install -r requirements.txt
```

**CORS Errors:**
Ensure all services are running on correct ports:
- Backend: 5000
- Classification: 5001
- Frontend: 5173

## API Documentation

### Authentication Endpoints

#### POST /signup
Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "plan": "free"
}
```

### Analysis Endpoints

#### POST /predict
Analyze sentiment of text data.

**Request Body:**
```json
{
  "texts": ["I love this product!", "This is terrible."]
}
```

**Response:**
```json
{
  "sentiment": "Positive",
  "positive_percentage": 65.5,
  "negative_percentage": 34.5
}
```

#### GET /fetch
Fetch Reddit posts for analysis.

**Query Parameters:**
- `keyword` (required): Search term
- `limit` (optional): Number of posts (default: 100)
- `filter` (optional): Time filter (all, day, week, month, year)

#### POST /generateSummary
Generate AI summary of sentiment analysis.

**Request Body:**
```json
{
  "keyword": "artificial intelligence",
  "sentiment": {
    "sentiment": "Positive",
    "positive_percentage": 70.5,
    "negative_percentage": 29.5
  },
  "posts": [...]
}
```

## Project Structure

```
project-sentiscope/
├── sentiscope-vite-app/          # React frontend
│   ├── src/
│   │   ├── components/           # Navbar component + tests
│   │   ├── pages/               # All page components
│   │   ├── styles/              # CSS files
│   │   └── firebase.ts          # Firebase configuration
│   ├── package.json
│   └── vite.config.ts
├── backend/                      # Flask API server
│   ├── app.py                   # Main application
│   ├── routes.py                # API routes
│   ├── firestore_config.py      # Database configuration
│   ├── reddit_config.py         # Reddit API integration
│   ├── redis_config.py          # Redis configuration
│   ├── test_routes.py           # API tests
│   └── requirements.txt
├── classification/               # ML service
│   ├── server.py                # Classification server
│   ├── sentiscope.pkl           # Trained model
│   ├── vectoriser.pkl           # Text vectorizer
│   ├── test_server.py           # ML service tests
│   └── requirements.txt
└── README.md
```

## Testing

Basic testing is included to demonstrate quality practices:

```bash
# Backend API tests
cd backend
python -m pytest test_routes.py

# Classification service tests
cd classification
python -m pytest test_server.py
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.