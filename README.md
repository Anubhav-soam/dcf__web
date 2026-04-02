# Indian Company Financials (Pure Web App)

This is a **pure web application** (no Python backend) built with:
- HTML
- CSS
- Vanilla JavaScript

It lets you enter an Indian company name, auto-resolves a `.BSE`/`.NSE` symbol, and fetches:
- Income Statement
- Balance Sheet
- Cash Flow Statement

for the past 4-5 years.

## Data source
- Alpha Vantage API (`SYMBOL_SEARCH`, `INCOME_STATEMENT`, `BALANCE_SHEET`, `CASH_FLOW`)

## Run
Because this is static, you can open `web/index.html` directly, or serve it:

```bash
python -m http.server 8080
```

Then visit:
- `http://localhost:8080/web/`

## Notes
- You need your own Alpha Vantage API key (free tier works).
- Free tier has rate limits (typically 5 requests/minute).
- Symbol matching quality depends on provider search results.
