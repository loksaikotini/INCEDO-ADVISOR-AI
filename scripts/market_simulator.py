"""
FILE: scripts/market_simulator.py
Streaming data simulator — publishes to Redis Pub/Sub:
  - market_feeds   : ticker price updates every 5s (live from Yahoo Finance if available)
  - trade_events   : random trade events every 10s
  - compliance_alerts : periodic compliance alerts every 20s
  - anomaly_alerts    : periodic anomaly alerts (RSS news feeds)
"""
import os
import json
import time
import random
import urllib.request
import xml.etree.ElementTree as ET
import redis as redis_lib
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

TICKERS = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "NVDA", "SPY", "BND", "GLD"]
base_prices = {
    "AAPL": 175.50, "MSFT": 380.00, "AMZN": 185.00,
    "GOOGL": 175.00, "TSLA": 240.00, "NVDA": 870.00,
    "SPY": 505.00, "BND": 72.30, "GLD": 225.00,
}

def get_redis():
    r = redis_lib.from_url(REDIS_URL)
    r.ping()
    return r

FINNHUB_API_KEY = "d87tl61r01qmhakhb590d87tl61r01qmhakhb59g"

def fetch_finnhub_price(ticker):
    try:
        url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={FINNHUB_API_KEY}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            if 'c' in data and data['c']:
                return float(data['c'])
    except Exception:
        pass
    return None

def fetch_live_price(ticker):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1m&range=1d"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            res = data.get('chart', {}).get('result', [])
            if res:
                meta = res[0].get('meta', {})
                return meta.get('regularMarketPrice')
    except Exception:
        pass
    return None

def fetch_rss_news():
    try:
        url = "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"  # WSJ Markets RSS
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            tree = ET.fromstring(response.read().decode())
            items = tree.findall('.//item')
            if items:
                item = random.choice(items[:5])
                title = item.find('title').text if item.find('title') is not None else "Market update"
                return title
    except Exception:
        pass
    return None

def publish_market_feed(r):
    for ticker in TICKERS:
        # 1. Primary: Finnhub
        live_price = fetch_finnhub_price(ticker)
        
        # 2. Secondary: Yahoo Finance
        if not live_price:
            live_price = fetch_live_price(ticker)
            
        if live_price:
            price = live_price
            change_pct = (price - base_prices[ticker]) / base_prices[ticker]
        else:
            # Fallback: Random walk
            change_pct = random.gauss(0, 0.002)
            price = round(base_prices[ticker] * (1 + change_pct), 2)
            base_prices[ticker] = price
            
        event = {
            "type": "MARKET_FEED",
            "payload": {
                "ticker": ticker,
                "price": price,
                "change_pct": round(change_pct * 100, 4),
                "volume": random.randint(100000, 5000000),
                "bid": round(price * 0.9999, 2),
                "ask": round(price * 1.0001, 2),
                "is_live": bool(live_price)
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
        r.publish("market_feeds", json.dumps(event))

def publish_trade_event(r):
    ticker = random.choice(TICKERS)
    price = base_prices[ticker]
    trade_type = random.choice(["BUY", "SELL"])
    qty = random.randint(10, 1000)
    event = {
        "type": "TRADE_EVENT",
        "payload": {
            "ticker": ticker,
            "trade_type": trade_type,
            "quantity": qty,
            "price": price,
            "notional_value": round(qty * price, 2),
            "account_type": random.choice(["IRA", "BROKERAGE", "401K"]),
            "status": "PENDING",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
    r.publish("trade_events", json.dumps(event))

def publish_compliance_alert(r):
    alerts = [
        {"rule": "Single Sector Concentration Limit", "category": "CONCENTRATION_RISK", "severity": "BLOCK"},
        {"rule": "Conservative Client Equity Limit", "category": "SUITABILITY", "severity": "WARN"},
        {"rule": "Leverage Limit", "category": "LEVERAGE", "severity": "BLOCK"},
    ]
    alert = random.choice(alerts)
    event = {
        "type": "COMPLIANCE_ALERT",
        "payload": {
            **alert,
            "client_id": f"client_{random.randint(1, 50)}",
            "description": f"Auto-detected compliance issue: {alert['rule']}",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
    r.publish("compliance_alerts", json.dumps(event))

def publish_anomaly_alert(r):
    news = fetch_rss_news()
    if news:
        desc = f"LIVE NEWS ALERT: {news}"
    else:
        ticker = random.choice(TICKERS)
        desc = f"Anomalous trading activity detected for {ticker}"
        
    event = {
        "type": "ANOMALY_ALERT",
        "payload": {
            "ticker": random.choice(TICKERS) if not news else "MKT",
            "anomaly_type": "NEWS_EVENT" if news else "UNUSUAL_VOLUME",
            "anomaly_score": round(-1 * random.uniform(0.05, 0.45), 4),
            "description": desc,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
    r.publish("anomaly_alerts", json.dumps(event))

if __name__ == "__main__":
    print(f"Connecting to Redis at {REDIS_URL}...")
    r = get_redis()
    print("Market simulator started. Publishing events...")

    last_feed = 0
    last_trade = 0
    last_compliance = 0
    last_anomaly = 0

    while True:
        try:
            now = time.time()

            if now - last_feed >= 5:
                publish_market_feed(r)
                last_feed = now

            if now - last_trade >= 10:
                publish_trade_event(r)
                last_trade = now

            if now - last_compliance >= 20:
                publish_compliance_alert(r)
                last_compliance = now

            if now - last_anomaly >= 30:
                publish_anomaly_alert(r)
                last_anomaly = now

            time.sleep(1)
        except redis_lib.exceptions.ConnectionError:
            print("Redis connection lost. Reconnecting...")
            time.sleep(2)
            try:
                r = get_redis()
            except:
                pass
        except Exception as e:
            print(f"Simulator error: {e}")
            time.sleep(2)
