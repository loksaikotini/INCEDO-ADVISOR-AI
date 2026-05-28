import os
import json
import random
import shutil
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'unstructured')

REPORTS_DIR = os.path.join(DATA_DIR, 'reports')
NOTES_DIR = os.path.join(DATA_DIR, 'notes')
EMAILS_DIR = os.path.join(DATA_DIR, 'emails')

# Clear existing unstructured data
if os.path.exists(DATA_DIR):
    shutil.rmtree(DATA_DIR)

os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(NOTES_DIR, exist_ok=True)
os.makedirs(EMAILS_DIR, exist_ok=True)

COMPANIES = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'NVDA']
SECTORS = ['Technology', 'Healthcare', 'Energy', 'Finance']

# Our seeded clients
CLIENTS = [
    {"name": "Michael Carter", "email": "michael.carter@example.com"},
    {"name": "Sarah Jenkins", "email": "sarah.jenkins@example.com"},
    {"name": "Robert Chen", "email": "robert.chen@example.com"},
    {"name": "Emma Watson", "email": "emma.watson@example.com"},
    {"name": "David Smith", "email": "david.smith@example.com"},
    {"name": "Jessica Lee", "email": "jessica.lee@example.com"},
    {"name": "Alice Miller", "email": "alice.miller@example.com"},
    {"name": "John Doe", "email": "john.doe@example.com"},
    {"name": "Frank Reynolds", "email": "frank.reynolds@example.com"},
    {"name": "Betty White", "email": "betty.white@example.com"}
]

def generate_reports():
    print(f"Generating research reports in {REPORTS_DIR}...")
    for company in COMPANIES:
        sector = random.choice(SECTORS)
        content = f"""# Equity Research Report: {company}
Date: {datetime.now().strftime('%Y-%m-%d')}
Sector: {sector}
Analyst: Sarah Chen

## Executive Summary
{company} continues to show strong momentum in the {sector} space. We expect {company} to outperform market expectations due to its robust pipeline.

## Key Risks
- Regulatory scrutiny.
- Increased competition.

## Recommendation: BUY
Price Target: $ {random.randint(150, 900)}.00
"""
        with open(os.path.join(REPORTS_DIR, f'report_{company}.md'), 'w') as f:
            f.write(content)

def generate_notes():
    print(f"Generating advisor notes in {NOTES_DIR}...")
    for client in CLIENTS:
        content = f"""Advisor Note - {client['name']}
Date: {(datetime.now() - timedelta(days=random.randint(1, 15))).strftime('%Y-%m-%d')}

Spoke with {client['name']} regarding their recent portfolio allocation. 
{ 'We discussed the need for KYC documentation.' if client['name'] == 'Sarah Jenkins' else '' }
{ 'Client is approaching retirement and wants to shift to fixed income.' if client['name'] == 'Alice Miller' else '' }
{ 'Discussed the large cash balance sitting idle.' if client['name'] == 'Frank Reynolds' else '' }
{ 'Reviewed tech sector exposure which has drifted significantly.' if client['name'] == 'Emma Watson' else '' }
They mentioned an upcoming life event that we need to plan for.

Follow up: Schedule a review in 3 months.
"""
        fname = client['name'].replace(' ', '_').lower()
        with open(os.path.join(NOTES_DIR, f'note_{fname}.txt'), 'w') as f:
            f.write(content)

def generate_emails():
    print(f"Generating client emails in {EMAILS_DIR}...")
    for client in CLIENTS:
        subject = random.choice(["Portfolio Review Request", "Question about my account", "Upcoming wire transfer", "Market volatility"])
        if client['name'] == 'Sarah Jenkins':
            subject = "Re: Missing KYC Documentation"
            body = f"Hi Sarah,\n\nI will send the missing KYC documents tomorrow. Apologies for the delay.\n\nThanks,\n{client['name']}"
        elif client['name'] == 'Emma Watson':
            subject = "Tech Stock Volatility"
            body = f"Hi Sarah,\n\nWith AAPL and NVDA moving so much, should we rebalance my portfolio to reduce my 35% tech allocation?\n\nThanks,\n{client['name']}"
        else:
            body = f"Hi Sarah,\n\nI was looking at my statement and wanted to ask about the recent changes. Also, I will need to withdraw $10,000 next month.\n\nThanks,\n{client['name']}"

        email = {
            "from": client['email'],
            "to": "sarah.chen@apex.com",
            "date": (datetime.now() - timedelta(days=random.randint(1, 10))).isoformat(),
            "subject": subject,
            "body": body
        }
        fname = client['name'].replace(' ', '_').lower()
        with open(os.path.join(EMAILS_DIR, f'email_{fname}.json'), 'w') as f:
            json.dump(email, f, indent=2)

if __name__ == "__main__":
    generate_reports()
    generate_notes()
    generate_emails()
    print("Unstructured data generation complete.")
