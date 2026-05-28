# API Keys & .env Setup Guide 🔑

To make the AI Advisor Copilot work, it needs to talk to real AI models on the internet. To do this securely, it uses **API Keys**. Think of an API Key like a secret password that gives your app permission to use an AI company's supercomputers.

This guide will show you exactly how to get these keys for free and how to put them in your `.env` file.

---

## 1️⃣ How to get your Google Gemini API Key

We use Google's Gemini AI to power the main conversational brain of the Copilot. 

1. **Go to the Website**: Open your browser and go to [Google AI Studio](https://aistudio.google.com/).
2. **Sign In**: Log in with your standard Google (Gmail) account.
3. **Get the Key**: 
   - Look for the button on the left sidebar that says **"Get API key"**.
   - Click **"Create API key"**.
   - A long string of random letters and numbers will pop up (e.g., `AIzaSyB...`). 
   - **Copy this key** to your clipboard.

---

## 2️⃣ How to get your Cohere API Key

We use Cohere's specialized AI to power the "Reranker" — this is what allows the app to search through thousands of financial documents instantly and find the most relevant ones.

1. **Go to the Website**: Open your browser and go to the [Cohere Dashboard](https://dashboard.cohere.com/).
2. **Sign Up**: Create a free account (you can use Google or GitHub to log in quickly).
3. **Get the Key**:
   - Once logged in, look at the left sidebar and click on **"API Keys"**.
   - Scroll down to the "Trial Keys" section.
   - Click the little copy icon next to your default Trial Key (e.g., `abc123XYZ...`).
   - **Copy this key** to your clipboard.

---

## 3️⃣ Setting up your `.env` File

Now that you have your keys, you need to save them in your project so the code can read them!

1. Open the main `advisor-ai` folder on your computer.
2. Look for a file named `.env`. 
   - *If you don't see it, create a new text document and name it exactly `.env` (don't forget the dot at the beginning!)*.
3. Open the `.env` file in Notepad or any text editor.
4. Paste the following template into the file:

```env
# ----------------------------------------------------
# 🧠 AI MODEL API KEYS (Paste your keys inside the quotes)
# ----------------------------------------------------
GEMINI_API_KEY="paste_your_google_key_here"
COHERE_API_KEY="paste_your_cohere_key_here"

# ----------------------------------------------------
# 🗄️ DATABASE SETTINGS
# ----------------------------------------------------
# Replace 'postgres' and 'password' with your PostgreSQL username and password if they are different.
DATABASE_URL="postgresql://postgres:password@localhost:5432/advisor_ai?schema=public"
DIRECT_DATABASE_URL="postgresql://postgres:password@localhost:5432/advisor_ai?schema=public"

# ----------------------------------------------------
# 🔒 SYSTEM SECURITY
# ----------------------------------------------------
# You can literally type any random string of characters here. 
# It is used to securely sign logins.
JWT_SECRET="my_super_secret_random_password_123!"
```

### Final Step:
Replace `"paste_your_google_key_here"` and `"paste_your_cohere_key_here"` with the actual keys you copied from the websites. **Keep the quotation marks around the keys!**

Save the file, and you are completely done! 🎉 You can now run `.\dev.bat` to start the app.
