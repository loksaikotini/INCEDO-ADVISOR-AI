# Incedo Advisor AI 🚀

Welcome to **Incedo Advisor AI**! 

This is a modern, intelligent web application designed to help financial advisors manage client portfolios, monitor compliance alerts, and get instant answers using AI. 

Just follow the steps below carefully!

---

## 🛠️ What You Need Installed (Prerequisites)

Before you begin, you need exactly 3 pieces of software installed on your computer. If you don't have them, download and install them first:

1. **Node.js (v18 or higher)** - [Download Here](https://nodejs.org/) (This runs the frontend website)
2. **Python (v3.11)** - [Download Here](https://www.python.org/downloads/) (This runs the AI backend)
3. **PostgreSQL** - [Download Here](https://www.postgresql.org/download/) (This stores all the data)
   *Note: Make sure to remember the database password you create when installing PostgreSQL!*

---

## ⚙️ Step 1: Set Up the Database

The application needs a place to store data (like user profiles and chat history). 

1. Open a terminal or command prompt.
2. Ensure your PostgreSQL server is running. 
3. Create a new empty database named `advisor_ai` using your database tool (like pgAdmin) or by running this in the terminal (if you have psql installed):
   ```bash
   createdb advisor_ai
   ```

---

## 🔑 Step 2: Environment Variables (The Secret Keys)

The project needs some secret keys (like passwords and AI keys) to work. 

1. Open the folder where this project is located.
2. Find the file named `.env` in the root folder. (If it doesn't exist, create a new text file and name it exactly `.env`).
3. Make sure the file has the following basic settings:

```env
# Database Connection (Replace 'postgres' and 'password' with your actual postgres username and password)
DATABASE_URL="postgresql://postgres:password@localhost:5432/advisor_ai?schema=public"
DIRECT_DATABASE_URL="postgresql://postgres:password@localhost:5432/advisor_ai?schema=public"

# AI Keys (You will need to get these keys from Google and Cohere)
GEMINI_API_KEY="your_google_gemini_api_key_here"
COHERE_API_KEY="your_cohere_api_key_here"

# System Settings
JWT_SECRET="make_up_a_random_secret_password_here"
```

---

## 📦 Step 3: Install the Project Dependencies

Now we need to download all the code libraries the project uses. You can do this automatically or manually.

### Option 1: The Automated Way (Recommended)
Simply run the setup batch script located in the root folder. It will install all Node modules, set up the database, and create the Python virtual environment for you!
1. Double-click the file named **`setup-all.bat`**
2. Wait for the terminal to finish installing everything.

### Option 2: The Manual Way
If you prefer to install things step-by-step:

1. Open a terminal in the project folder (`advisor-ai`).
2. Run this command to install the frontend web tools:
   ```bash
   npm install -g pnpm
   pnpm install
   ```
3. Run this command to setup the database tables and add dummy data:
   ```bash
   pnpm run db:generate
   pnpm run db:migrate
   pnpm run db:seed
   ```
4. Now, set up the Python backend tools. Run these commands:
   ```bash
   cd apps\copilot-backend-legacy
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   pip install cohere prisma
   cd ..\..
   ```

---

## 🚀 Step 4: Run the Application!

You've done the hard part! Running the application is incredibly easy.

1. Double-click the file named **`dev.bat`** in the project folder. 
2. Alternatively, open a terminal in the project folder and type:
   ```bash
   .\dev.bat
   ```

**What happens next?**
The script will automatically open 5 different terminal windows, starting up the API Gateway, the AI Orchestrator, the Compliance Engine, the Background Services, and finally the beautiful User Interface.

Once it says "Ready", open your web browser (like Chrome or Edge) and go to:
👉 **http://localhost:3000**

You can now log in and explore Incedo Advisor AI! 🎉
