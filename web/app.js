const form = document.getElementById('search-form');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const headerEl = document.getElementById('companyHeader');
const tablesEl = document.getElementById('tables');

const SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const SUMMARY_URL = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

function toNum(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Network request failed (${res.status}).`);
  return res.json();
}

async function findIndianSymbols(companyName) {
  const url = `${SEARCH_URL}?${new URLSearchParams({
    q: companyName,
    quotesCount: '10',
    newsCount: '0',
    lang: 'en-US',
    region: 'IN',
  })}`;

  const data = await fetchJson(url);
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];

  const symbols = quotes
    .filter((item) => {
      const symbol = String(item.symbol || '');
      return item.quoteType === 'EQUITY' && (symbol.endsWith('.NS') || symbol.endsWith('.BO'));
    })
    .map((item) => ({ symbol: item.symbol, name: item.shortname || item.longname || companyName }));

  if (!symbols.length) {
    throw new Error('No NSE/BSE listed company found for this name. Try a more specific query.');
  }

  return symbols;
}

function normalizeStatement(rawHistory, yearsLimit) {
  const entries = rawHistory?.financials || rawHistory?.balanceSheetStatements || rawHistory?.cashflowStatements || [];
  if (!Array.isArray(entries) || !entries.length) return { years: [], data: {} };

  const picked = entries.slice(0, yearsLimit);
  const years = picked
    .map((entry) => entry.endDate?.fmt || entry.endDate?.raw)
    .filter(Boolean)
    .map((d) => String(new Date(d).getUTCFullYear()));

  const metrics = Object.keys(picked[0]).filter((k) => !['maxAge', 'endDate'].includes(k));
  const data = {};

  for (const metric of metrics) {
    data[metric] = {};
    picked.forEach((entry, index) => {
      const year = years[index];
      if (!year) return;
      const valueObj = entry[metric];
      const val = valueObj?.raw ?? valueObj?.fmt ?? null;
      data[metric][year] = toNum(val);
    });
  }

  return { years, data };
}

async function fetchStatementsForSymbol(symbol, yearsLimit) {
  const modules = [
    'incomeStatementHistory',
    'incomeStatementHistoryQuarterly',
    'balanceSheetHistory',
    'cashflowStatementHistory',
  ].join(',');

  const url = `${SUMMARY_URL}/${encodeURIComponent(symbol)}?${new URLSearchParams({ modules })}`;
  const payload = await fetchJson(url);

  const result = payload?.quoteSummary?.result?.[0];
  if (!result) throw new Error('No financial payload for selected symbol.');

  const income = normalizeStatement(result.incomeStatementHistory, yearsLimit);
  const balance = normalizeStatement(result.balanceSheetHistory, yearsLimit);
  const cash = normalizeStatement(result.cashflowStatementHistory, yearsLimit);

  const anyData = income.years.length || balance.years.length || cash.years.length;
  if (!anyData) throw new Error('Financial statements are unavailable for this symbol.');

  const years = income.years.length ? income.years : balance.years.length ? balance.years : cash.years;
  return { years, income: income.data, balance: balance.data, cash: cash.data };
}

function buildTable(title, statement, years) {
  const metrics = Object.keys(statement || {});
  if (!metrics.length) return `<article class="card"><h3>${title}</h3><p>No data found.</p></article>`;

  const header = years.map((y) => `<th>${y}</th>`).join('');
  const rows = metrics
    .map((metric) => {
      const values = years.map((year) => `<td>${formatNumber(statement[metric][year] ?? null)}</td>`).join('');
      return `<tr><th>${metric}</th>${values}</tr>`;
    })
    .join('');

  return `<article class="card"><h3>${title}</h3><div class="table-wrap"><table><thead><tr><th>Metric</th>${header}</tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Fetching data...';
  resultsEl.classList.add('hidden');
  tablesEl.innerHTML = '';

  const companyName = document.getElementById('companyName').value.trim();
  const yearsLimit = Number(document.getElementById('years').value || '5');

  try {
    const candidateSymbols = await findIndianSymbols(companyName);

    let selected = null;
    let statements = null;
    let lastError = null;

    for (const candidate of candidateSymbols) {
      try {
        statements = await fetchStatementsForSymbol(candidate.symbol, yearsLimit);
        selected = candidate;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!selected || !statements) {
      throw lastError || new Error('Unable to fetch financial statements for matching symbols.');
    }

    headerEl.textContent = `${selected.name} (${selected.symbol})`;
    tablesEl.innerHTML = [
      buildTable('Income Statement', statements.income, statements.years),
      buildTable('Balance Sheet', statements.balance, statements.years),
      buildTable('Cash Flow Statement', statements.cash, statements.years),
    ].join('');

    resultsEl.classList.remove('hidden');
    statusEl.textContent = 'Done.';
  } catch (error) {
    statusEl.textContent = error.message || 'Unable to fetch statements.';
  }
});
