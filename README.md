# IntelliTraffic-AI

### AI-Powered Emergency Mobility and Fleet Intelligence Platform

IntelliTraffic AI is a hackathon prototype designed to improve emergency mobility by helping ambulance operators and dispatchers make faster, data-informed decisions during road accidents and medical emergencies.

The platform aims to connect emergency reporting, ambulance dispatch, fleet management, route intelligence, and operational analytics in one unified system.

## Problem Statement

During medical emergencies, delays in reporting, ambulance allocation, traffic congestion, and communication between dispatchers and ambulance drivers can affect response times.

Traditional emergency coordination often relies on fragmented information and manual decision-making, making it difficult to identify available ambulances, choose efficient routes, and coordinate emergency response effectively.

## Our Solution

IntelliTraffic AI aims to provide a centralized emergency mobility platform that supports:

- Emergency incident reporting
- Dispatcher coordination and case management
- Ambulance fleet visibility and management
- Route and estimated travel-time intelligence
- Emergency response tracking
- Operational analytics and audit records

The goal is to support better-informed dispatch decisions and improve emergency response coordination.

## Key Features

### 1. Emergency Reporting

- Report an emergency through a simplified interface.
- Capture incident details and severity.
- Support location-based incident handling.

### 2. Intelligent Dispatch

- Centralized dashboard for dispatchers.
- Emergency case monitoring and management.
- Support for ambulance assignment and dispatch workflows.

### 3. Fleet Management

- Track ambulance availability and operational status.
- Organize fleet information for dispatch decisions.
- Support coordination between dispatchers and ambulance teams.

### 4. Route Intelligence

- Designed to support route and estimated travel-time information.
- Intended to help dispatchers consider traffic and route conditions.
- Can be extended with Google Maps Platform APIs for real-time route information.

### 5. Analytics and Audit

- Operational dashboard and response-related metrics.
- Records to support case tracking and review.
- Potential for future performance and resource-utilization analysis.

## Technology Stack

**Frontend**

- React
- Vite
- JavaScript
- CSS

**Backend**

- Python
- FastAPI
- Uvicorn

**Database**

- SQLite for local development

**Mapping and Routing**

- Google Maps Platform integration planned or configurable, depending on API setup

## Project Architecture

The platform follows a frontend-backend architecture.

- **Frontend:** Provides the user interface for emergency reporting, dispatch, fleet management, and analytics.
- **Backend:** Exposes API endpoints for application operations and business logic.
- **Database:** Stores application data during development.
- **Routing integration:** Can provide route and travel-time information when configured with a supported mapping API.

[IntelliTraffic AI Demo](https://drive.google.com/drive/u/1/folders/1gTeV2emqa6jwgEcaJkltIvCg3hoSfOYB)

## Getting Started

### Prerequisites

Install the following:

- Python 3.10
- Node.js and npm
- Git

Python 3.10 is recommended for the project's current pinned backend dependencies.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/IntelliTraffic-AI.git
cd IntelliTraffic-AI
```

Replace `YOUR-USERNAME` with the GitHub account that hosts this repository.

### 2. Set Up the Backend

Open a terminal and navigate to the backend directory:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Start the API server:

```bash
python -m uvicorn main:app --reload --port 8000
```

If the application fails to start, check the terminal traceback and the backend entry-point file before proceeding.

Open the API documentation at:

http://127.0.0.1:8000/docs

### 3. Set Up the Frontend

Open a second terminal and navigate to the frontend directory from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed in the terminal, usually:

http://localhost:5173

Keep both development servers running while testing the application.

## ⚙️ Configuration

Configure required environment variables locally in the appropriate backend environment file. Do not commit secrets or API keys to GitHub.

If using Google Maps Platform, configure the relevant API key and enable the required APIs in Google Cloud Console. Restrict API keys appropriately and review billing requirements.

For hosted deployment, configure the frontend API base URL and backend CORS settings to use the actual deployed service URLs.

## 🌐 Deployment

The prototype can be prepared for deployment using:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** A managed PostgreSQL service for persistent hosted data

Deployment requires configuring environment variables, CORS, database connectivity, and the frontend's backend API URL.

A successful deployment should be verified by testing the public frontend, backend health endpoint, API documentation, authentication, and main application workflows.

## 🧪 Current Project Status

IntelliTraffic AI is a hackathon prototype under development.

The project is intended to demonstrate an integrated approach to emergency reporting, dispatch coordination, fleet intelligence, and route-aware decision support.

The completeness and reliability of individual features depend on the current implementation and configuration. Real-time traffic data, live ambulance tracking, hospital capacity information, and production-grade AI decisions should not be assumed unless they have been implemented and tested.

## 🔮 Future Improvements

- Real-time ambulance tracking
- Traffic-aware route optimization
- AI-assisted ambulance allocation and prioritization
- Hospital selection based on verified capabilities and availability
- Live traffic simulation and road-closure handling
- Improved driver and dispatcher role-based dashboards
- Persistent production database and secure authentication
- Expanded analytics and response-time evaluation
- Integration with verified emergency service systems

## ⚠️ Disclaimer

IntelliTraffic AI is a hackathon prototype intended for demonstration and experimentation. It is not a replacement for official emergency services, professional medical judgment, or validated emergency dispatch systems. Do not rely on an unverified deployment for real-world emergency response.

## 👥 Team

Built as part of a hackathon project.

## 📄 License

A license has not yet been specified. Add an appropriate license before permitting others to reuse, modify, or distribute this project.
