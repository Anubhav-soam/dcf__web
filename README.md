# Indian Company Financial Statements Web App

A lightweight Flask website where you type an Indian company name and it fetches annual financial statements for the last 4-5 years:

- Income Statement
- Balance Sheet
- Cash Flow Statement

## How it works

1. Searches Yahoo Finance for NSE/BSE symbols (`.NS` / `.BO`) from the entered company name.
2. Pulls statement data through `yfinance`.
3. Renders data in statement tables on a simple web UI.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open `http://127.0.0.1:5000`.

## Notes

- `years` is capped at 5 by API.
- Data availability depends on Yahoo Finance coverage for the specific company.
