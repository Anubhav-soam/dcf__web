const form = document.getElementById('search-form');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const headerEl = document.getElementById('companyHeader');
const tablesEl = document.getElementById('tables');

const API_BASE = 'https://www.alphavantage.co/query';

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

async function avQuery(params) {
  const url = `${API_BASE}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error while reaching Alpha Vantage.');
  return res.json();
}

async function findIndianSymbol(keywords, apikey) {
  const data = await avQuery({ function: 'SYMBOL_SEARCH', keywords, apikey });
  const best = (data.bestMatches || []).find((item) => {
    const s = item['1. symbol'] || '';
    return s.endsWith('.BSE') || s.endsWith('.NSE');
  });

  if (!best) throw new Error('No Indian listed symbol found (.BSE/.NSE). Try a more specific company name.');
  return {
    symbol: best['1. symbol'],
    name: best['2. name'] || keywords,
  };
}

async function fetchStatement(fn, symbol, apikey) {
  const data = await avQuery({ function: fn, symbol, apikey });
  if (data.Note) throw new Error('Alpha Vantage rate limit hit. Wait 1 minute and retry.');
  if (data.Information) throw new Error(data.Information);
  if (data.ErrorMessage) throw new Error(data.ErrorMessage);
  return data.annualReports || [];
}

function buildTable(title, rows, years) {
  if (!rows.length) return `<article class="card"><h3>${title}</h3><p>No data found.</p></article>`;

  const metrics = Object.keys(rows[0]).filter((k) => k !== 'fiscalDateEnding' && k !== 'reportedCurrency');
  const yearMap = new Map();

  for (const row of rows.slice(0, years)) {
    const year = String(new Date(row.fiscalDateEnding).getUTCFullYear());
    yearMap.set(year, row);
  }

  const yearHeaders = [...yearMap.keys()];
  const header = yearHeaders.map((y) => `<th>${y}</th>`).join('');

  const body = metrics
    .map((metric) => {
      const cells = yearHeaders
        .map((year) => `<td>${formatNumber(toNum(yearMap.get(year)[metric]))}</td>`)
        .join('');
      return `<tr><th>${metric}</th>${cells}</tr>`;
    })
    .join('');

  return `<article class="card"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>Metric</th>${header}</tr></thead><tbody>${body}</tbody></table></div></article>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Fetching data...';
  resultsEl.classList.add('hidden');
  tablesEl.innerHTML = '';

  const apikey = document.getElementById('apiKey').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const years = Number(document.getElementById('years').value || '5');

  try {
    const company = await findIndianSymbol(companyName, apikey);
    const [income, balance, cashflow] = await Promise.all([
      fetchStatement('INCOME_STATEMENT', company.symbol, apikey),
      fetchStatement('BALANCE_SHEET', company.symbol, apikey),
      fetchStatement('CASH_FLOW', company.symbol, apikey),
    ]);

    headerEl.textContent = `${company.name} (${company.symbol})`;
    tablesEl.innerHTML = [
      buildTable('Income Statement', income, years),
      buildTable('Balance Sheet', balance, years),
      buildTable('Cash Flow Statement', cashflow, years),
    ].join('');

    resultsEl.classList.remove('hidden');
    statusEl.textContent = 'Done.';
  } catch (error) {
    statusEl.textContent = error.message || 'Unable to fetch statements.';
  }
});
