from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd
import requests
import yfinance as yf
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"


@dataclass
class FinancialResponse:
    company: str
    symbol: str
    years: list[str]
    income_statement: dict[str, dict[str, Any]]
    balance_sheet: dict[str, dict[str, Any]]
    cash_flow: dict[str, dict[str, Any]]


def _format_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return int(value) if float(value).is_integer() else round(float(value), 2)
    return value


def _clean_statement(df: pd.DataFrame, limit: int) -> tuple[list[str], dict[str, dict[str, Any]]]:
    if df is None or df.empty:
        return [], {}

    # yfinance returns dates as columns, metrics as rows
    sorted_cols = sorted(df.columns, reverse=True)[:limit]
    trimmed = df[sorted_cols]

    years = [col.strftime("%Y") for col in sorted_cols]
    statement: dict[str, dict[str, Any]] = {}
    for metric, row in trimmed.iterrows():
        statement[metric] = {
            col.strftime("%Y"): _format_value(row[col]) for col in sorted_cols
        }

    return years, statement


def find_indian_symbol(company_name: str) -> str | None:
    params = {
        "q": company_name,
        "quotesCount": 10,
        "newsCount": 0,
        "lang": "en-US",
        "region": "IN",
    }
    response = requests.get(SEARCH_URL, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    quotes = data.get("quotes", [])
    indian_quotes = [
        q
        for q in quotes
        if str(q.get("symbol", "")).endswith((".NS", ".BO")) and q.get("quoteType") == "EQUITY"
    ]

    if indian_quotes:
        return indian_quotes[0]["symbol"]

    return None


def fetch_financials(company_name: str, years_limit: int) -> FinancialResponse:
    symbol = find_indian_symbol(company_name)
    if not symbol:
        raise ValueError("Could not find an NSE/BSE listed company for that name.")

    ticker = yf.Ticker(symbol)

    income_years, income_statement = _clean_statement(ticker.financials, years_limit)
    balance_years, balance_sheet = _clean_statement(ticker.balance_sheet, years_limit)
    cash_years, cash_flow = _clean_statement(ticker.cashflow, years_limit)

    years = income_years or balance_years or cash_years
    if not years:
        raise ValueError("Financial statements are unavailable for this company.")

    return FinancialResponse(
        company=company_name,
        symbol=symbol,
        years=years,
        income_statement=income_statement,
        balance_sheet=balance_sheet,
        cash_flow=cash_flow,
    )


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/api/financials")
def api_financials():
    company = request.args.get("company", "").strip()
    years = request.args.get("years", "5").strip()

    if not company:
        return jsonify({"error": "Please provide a company name."}), 400

    try:
        years_limit = min(max(int(years), 1), 5)
    except ValueError:
        years_limit = 5

    try:
        payload = fetch_financials(company, years_limit)
    except requests.RequestException:
        return jsonify({"error": "Failed to reach finance data provider. Try again."}), 502
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception:
        return jsonify({"error": "Unexpected error while fetching financial statements."}), 500

    return jsonify(payload.__dict__)


if __name__ == "__main__":
    app.run(debug=True)
