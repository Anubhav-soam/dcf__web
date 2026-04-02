# Indian Company Financials (Pure Web App)

This is a **pure web application** (no backend) built with HTML/CSS/Vanilla JavaScript.

You type an Indian company name, and the app attempts to automatically fetch up to the last 4-5 years of:
- Income Statement
- Balance Sheet
- Cash Flow Statement

## Data source
- Yahoo Finance endpoints:
  - company search: `query1.finance.yahoo.com/v1/finance/search`
  - statements: `query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}`

## Run
Serve the static app locally:

```bash
python -m http.server 8080
```

Then open:
- `http://localhost:8080/web/`

## Notes
- No API key required.
- The app tries multiple matched Indian symbols (`.NS` / `.BO`) if the first one has missing data.
- Statement availability depends on Yahoo Finance coverage for the company.
