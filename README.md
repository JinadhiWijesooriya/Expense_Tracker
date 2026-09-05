# 💰 Spendwise - Expense Tracker

A modern full-stack personal finance and expense tracking web application built with **React**, **TypeScript**, **Vite**, **Django REST Framework**, and **ReportLab**.

---

## ✨ Features

- **📊 Comprehensive Dashboard:** Real-time summary of Balance, Total Income, Total Expenses, and Monthly Spending with interactive progress bars.
- **🔄 Full CRUD Operations:** Create, Read, Update, and Delete for:
  - **Transactions:** Categorize income & expenses with real-time balance calculations.
  - **Categories:** Manage expense and income categories with protection against accidental deletion when linked to existing transactions.
  - **Budgets:** Set monthly category budgets with dynamic progress bars and limit alerts (green, orange, and red when exceeded).
- **💱 Dual Currency Support:** Switch seamlessly between **USD ($)** and **Rupees (Rs.)** with persistent preferences across sessions.
- **📄 Monthly Statements (PDF & CSV):**
  - **PDF Export:** Branded statements featuring executive summaries, colored category breakdowns, and itemized transaction tables.
  - **CSV Export:** Tabular reports for spreadsheets (Excel / Google Sheets).
- **🔐 JWT Authentication:** Secure registration, login, and session tokens via Django SimpleJWT.
- **🎨 Modern Design:** Responsive layout, clean cards, quick action buttons, and active edit states.

---

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Vanilla CSS
- **Backend:** Django 6.1, Django REST Framework, SimpleJWT, ReportLab
- **Database:** SQLite

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Create a superuser (optional)
python manage.py createsuperuser

# Start backend dev server
python manage.py runserver
```
The Django API will be running at `http://127.0.0.1:8000/`.

---

### 3. Frontend Setup
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
The application will be accessible at `http://localhost:5173/`.

---

## 📜 License
This project is open source and available under the [MIT License](LICENSE).
