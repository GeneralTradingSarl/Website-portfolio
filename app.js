/*
  Fonte de dados: data/accounts.json
  Você pode editar esse arquivo para atualizar as contas e os resultados mensais.
  Nenhuma API paga é usada. Para integrar com MyFxBook manualmente, exporte CSV/JSON e atualize aqui.
*/

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Neutral names pool for realistic display (used only if dataset has not provided one)
const fallbackNames = [
  'A. Diallo', 'M. Fernandes', 'J. Laurent', 'S. Kamara', 'R. Martins',
  'I. Traoré', 'K. Duarte', 'P. Nascimento', 'T. Morel', 'L. Costa',
  'C. Mensah', 'E. Dlamini', 'N. Bernard', 'F. Baptiste', 'D. Okoro'
];

function getIdentity(account, index) {
  const displayName = account.personName || account.name || fallbackNames[index % fallbackNames.length];
  const avatar = account.avatar || `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(displayName)}&backgroundType=gradientLinear&radius=50`;
  return { displayName, avatar };
}

document.getElementById('year').textContent = new Date().getFullYear();

async function loadAccounts() {
  const res = await fetch('data/accounts.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Falha ao carregar dados');
  return res.json();
}

function computeMetrics(account) {
  const totalDeposit = account.totalDeposit ?? 0;
  const monthly = Array.isArray(account.monthly) ? account.monthly : [];
  const totalProfit = monthly.reduce((sum, m) => sum + (m.profit ?? 0), 0);
  const profitThisMonth = monthly.length ? (monthly[monthly.length - 1].profit ?? 0) : 0;
  const growthPct = totalDeposit > 0 ? totalProfit / totalDeposit : 0;
  return { totalDeposit, totalProfit, profitThisMonth, growthPct };
}

function computeGrowthSeries(account) {
  const { totalDeposit } = computeMetrics(account);
  const monthly = Array.isArray(account.monthly) ? account.monthly : [];
  let equity = totalDeposit;
  const labels = [];
  const equityPoints = [];
  monthly.forEach((m) => {
    equity += (m.profit ?? 0);
    labels.push(m.month);
    equityPoints.push(equity);
  });
  return { labels, equityPoints };
}

// Build multiple series for an account: equity, balance, profit, growth %, drawdown %
function buildAllSeries(account) {
  const { totalDeposit } = computeMetrics(account);
  const monthly = Array.isArray(account.monthly) ? account.monthly : [];
  const labels = monthly.map(m => m.month);

  // profit series (per month)
  const profit = monthly.map(m => m.profit ?? 0);

  // equity and balance series
  let balanceRunning = totalDeposit;
  let equityRunning = totalDeposit;
  const balance = [];
  const equity = [];
  const growthPct = [];
  let peakEquity = totalDeposit;
  const drawdownPct = [];

  for (const m of monthly) {
    const p = m.profit ?? 0;
    balanceRunning += p;
    equityRunning += p;
    peakEquity = Math.max(peakEquity, equityRunning);
    const dd = peakEquity > 0 ? (equityRunning - peakEquity) / peakEquity : 0; // negative or 0

    balance.push(balanceRunning);
    equity.push(equityRunning);
    growthPct.push(totalDeposit > 0 ? balanceRunning / totalDeposit - 1 : 0);
    drawdownPct.push(dd);
  }

  return { labels, profit, balance, equity, growthPct, drawdownPct };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function renderTable(accounts) {
  const tbody = document.getElementById('accountsTableBody');
  tbody.innerHTML = '';

  accounts.forEach((acc, index) => {
    const { displayName, avatar } = getIdentity(acc, index);
    const { totalDeposit, totalProfit, profitThisMonth, growthPct } = computeMetrics(acc);
    // Gain as cumulative growth
    const gainPct = growthPct;
    // Drawdown based on equity curve peak
    const series = buildAllSeries(acc);
    let peak = -Infinity; let ddMin = 0;
    series.equity.forEach(v => { peak = Math.max(peak, v); ddMin = Math.min(ddMin, (v - peak) / (peak || 1)); });
    const drawdownPct = ddMin; // negative

    const gainClass = gainPct >= 0 ? 'tag-pos' : 'tag-neg';
    const monthClass = profitThisMonth >= 0 ? 'tag-pos' : 'tag-neg';

    // small sparkline canvas
    const spark = document.createElement('canvas');
    spark.className = 'spark';
    setTimeout(() => {
      new Chart(spark.getContext('2d'), {
        type: 'line',
        data: { labels: series.labels, datasets: [{ data: series.equity, borderColor: 'rgba(138,180,255,1)', backgroundColor: 'rgba(138,180,255,0.05)', fill: true, tension: 0.25, borderWidth: 1, pointRadius: 0 }]},
        options: { responsive: false, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });
    }, 0);

    const tr = el('tr', {}, [
      el('td', {}, [
        el('div', { class: 'system-cell' }, [
          el('img', { class: 'system-avatar', src: avatar, alt: displayName }),
          el('span', { text: displayName })
        ])
      ]),
      el('td', {}, [el('span', { class: gainClass, text: percentFormatter.format(gainPct) })]),
      el('td', {}, [el('span', { class: drawdownPct <= 0 ? 'tag-neg' : 'tag-pos', text: percentFormatter.format(drawdownPct) })]),
      el('td', {}, [el('span', { class: monthClass, text: percentFormatter.format((profitThisMonth) / (totalDeposit || 1)) })]),
      el('td', {}, [spark]),
      el('td', {}, [
        el('button', { class: 'btn secondary', text: 'Ver perfil', id: `open-${index}` })
      ])
    ]);

    tbody.appendChild(tr);

    // wire open profile
    setTimeout(() => {
      const btn = document.getElementById(`open-${index}`);
      if (btn) btn.addEventListener('click', () => openAccountModal(acc, index));
    }, 0);
  });
}

function renderCharts(accounts) {
  const grid = document.getElementById('accountsGrid');
  grid.innerHTML = '';

  accounts.forEach((acc, index) => {
    const { displayName } = getIdentity(acc, index);
    const labels = (acc.monthly || []).map(m => m.month);
    const data = (acc.monthly || []).map(m => m.profit ?? 0);

    const card = el('div', { class: 'account-card' });
    const title = el('h3', { text: displayName });

    const { totalDeposit, totalProfit, profitThisMonth, growthPct } = computeMetrics(acc);
    const kpiRow = el('div', { class: 'kpi-row' }, [
      el('div', { class: 'kpi' }, [document.createTextNode(`Depósito: `), el('strong', { text: currencyFormatter.format(totalDeposit) })]),
      el('div', { class: 'kpi' }, [document.createTextNode(`Lucro mês: `), el('strong', { text: currencyFormatter.format(profitThisMonth) })]),
      el('div', { class: 'kpi' }, [document.createTextNode(`Lucro total: `), el('strong', { text: currencyFormatter.format(totalProfit) })]),
      el('div', { class: 'kpi' }, [document.createTextNode(`Crescimento: `), el('strong', { text: percentFormatter.format(growthPct) })])
    ]);
    const canvasWrap = el('div', { class: 'chart-wrap' });
    const canvas = el('canvas');
    canvasWrap.appendChild(canvas);
    const actions = el('div', { class: 'card-actions' }, [
      el('button', { class: 'btn secondary', 'data-acc': acc.name, id: `open-${Math.random().toString(36).slice(2)}` , text: 'Ver perfil' })
    ]);

    card.appendChild(title);
    card.appendChild(kpiRow);
    card.appendChild(canvasWrap);
    card.appendChild(actions);
    grid.appendChild(card);

    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Lucro mensal (R$)',
          data,
          backgroundColor: data.map(v => v >= 0 ? 'rgba(31, 111, 235, 0.8)' : 'rgba(243, 18, 96, 0.8)'),
          borderColor: data.map(v => v >= 0 ? 'rgba(31, 111, 235, 1)' : 'rgba(243, 18, 96, 1)'),
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#a4b1c9' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#a4b1c9',
              callback: (val) => currencyFormatter.format(val)
            }
          }
        },
        plugins: {
          legend: { labels: { color: '#e8f0ff' } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${currencyFormatter.format(ctx.parsed.y)}`
            }
          }
        }
      }
    });

    // Open modal handler
    actions.querySelector('button').addEventListener('click', () => openAccountModal(acc, index));
  });
}

let modalMonthlyChart = null;
let modalGrowthChart = null;
let modalMainChart = null;
let modalAuxCharts = [];

function destroyModalCharts() {
  try { if (modalMainChart) { modalMainChart.destroy(); modalMainChart = null; } } catch {}
  modalAuxCharts.forEach(ch => { try { ch.destroy(); } catch {} });
  modalAuxCharts = [];
}

function ensureTrades(account) {
  if (Array.isArray(account.trades) && account.trades.length) return account.trades;
  // Generate synthetic trades from monthly data for realism
  const months = Array.isArray(account.monthly) ? account.monthly : [];
  const trades = [];
  let idCounter = 1;
  const symbols = ['EURUSD','GBPUSD','XAUUSD','US100','BTCUSD','USDJPY'];
  months.forEach((m, idx) => {
    const num = 6 + Math.floor(Math.random() * 6); // 6-11 trades per month
    for (let i = 0; i < num; i++) {
      const pips = (Math.random() * 60 - 20) * (Math.random() > 0.5 ? 1 : -1);
      const profit = (pips * (50 + Math.random() * 150)) / 10;
      const signBias = Math.sign(m.profit || 0) || (Math.random() > 0.5 ? 1 : -1);
      const adjProfit = profit * (signBias > 0 ? 1.1 : 0.9);
      trades.push({
        id: `G${String(idCounter++).padStart(3,'0')}`,
        date: `${m.month}-` + String(2 + Math.floor(Math.random()*26)).padStart(2,'0'),
        symbol: symbols[(idx + i) % symbols.length],
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        lots: Number((0.2 + Math.random() * 1.5).toFixed(2)),
        pips: Number(pips.toFixed(1)),
        profit: Number(adjProfit.toFixed(2)),
        duration: 30 + Math.floor(Math.random() * 2880),
        maePips: Number((-5 - Math.random() * 60).toFixed(1)),
        mfePips: Number((5 + Math.random() * 80).toFixed(1)),
        hour: Math.floor(Math.random() * 24),
        weekday: Math.floor(Math.random() * 7)
      });
    }
  });
  account.trades = trades;
  return trades;
}

function computeTradeStats(trades) {
  const total = trades.length || 0;
  if (!total) return { total: 0, profitabilityPct: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, expectancy: 0 };
  const wins = trades.filter(t => (t.profit || 0) > 0);
  const losses = trades.filter(t => (t.profit || 0) < 0);
  const grossWin = wins.reduce((s,t)=>s+(t.profit||0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.profit||0),0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? -(grossLoss / losses.length) : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
  const winRate = wins.length / total;
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss;
  return {
    total,
    profitabilityPct: winRate * 100,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy
  };
}

function deriveAdvancedFromTrades(trades) {
  const stats = computeTradeStats(trades);
  const total = trades.length;
  const pipsSum = trades.reduce((s,t)=> s + (t.pips || 0), 0);
  const wins = trades.filter(t => (t.profit || 0) > 0);
  const losses = trades.filter(t => (t.profit || 0) < 0);
  const avgWinPips = wins.length ? wins.reduce((s,t)=> s + (t.pips || 0), 0) / wins.length : 0;
  const avgLossPips = losses.length ? losses.reduce((s,t)=> s + (t.pips || 0), 0) / losses.length : 0;
  const lots = trades.reduce((s,t)=> s + (t.lots || 0), 0);
  const commissions = 0;
  const longTrades = trades.filter(t => t.side === 'buy');
  const shortTrades = trades.filter(t => t.side === 'sell');
  const longsWon = { won: longTrades.filter(t => (t.profit || 0) > 0).length, total: longTrades.length };
  const shortsWon = { won: shortTrades.filter(t => (t.profit || 0) > 0).length, total: shortTrades.length };
  const bestTradeCurrency = trades.reduce((b,t)=> (b==null || (t.profit||-Infinity) > b.value) ? { date: t.date, value: t.profit||0 } : b, null) || { date: '', value: 0 };
  const worstTradeCurrency = trades.reduce((b,t)=> (b==null || (t.profit||Infinity) < b.value) ? { date: t.date, value: t.profit||0 } : b, null) || { date: '', value: 0 };
  const bestTradePips = trades.reduce((b,t)=> (b==null || (t.pips||-Infinity) > b.value) ? { date: t.date, value: t.pips||0 } : b, null) || { date: '', value: 0 };
  const worstTradePips = trades.reduce((b,t)=> (b==null || (t.pips||Infinity) < b.value) ? { date: t.date, value: t.pips||0 } : b, null) || { date: '', value: 0 };
  const avgTradeLength = (() => { const m = trades.reduce((s,t)=> s + (t.duration || 0), 0) / (total || 1); const d = Math.round(m / 1440); return d >= 1 ? `${d}d` : `${Math.round(m/60)}h`; })();
  return {
    trades: total,
    pips: Number(pipsSum.toFixed(1)),
    avgWinPips: Number(avgWinPips.toFixed(2)),
    avgWinCurrency: stats.avgWin,
    avgLossPips: Number(avgLossPips.toFixed(2)),
    avgLossCurrency: stats.avgLoss,
    lots: Number(lots.toFixed(2)),
    commissions,
    longsWon,
    shortsWon,
    bestTradeCurrency,
    worstTradeCurrency,
    bestTradePips,
    worstTradePips,
    avgTradeLength,
    profitFactor: Number((stats.profitFactor === Infinity ? 999 : stats.profitFactor).toFixed(2)),
    stdDev: Math.abs(stats.expectancy) * 10,
    sharpe: 0,
    zScore: { value: 0, probability: 50 },
    expectancy: { pips: Number((stats.expectancy / 10).toFixed(1)), currency: stats.expectancy },
    ahpr: Number((stats.profitabilityPct / 100 * 0.05).toFixed(2)),
    ghpr: Number((stats.profitabilityPct / 100 * 0.05).toFixed(2))
  };
}

function openAccountModal(account, index = 0) {
  const modal = document.getElementById('accountModal');
  const title = document.getElementById('accountModalTitle');
  const kpis = document.getElementById('accountModalKpis');
  const mainCanvas = document.getElementById('modalMainCanvas');
  const metricSelect = document.getElementById('modalMetricSelect');
  const hourlyCanvas = document.getElementById('modalHourlyCanvas');
  const dailyCanvas = document.getElementById('modalDailyCanvas');
  const rorCanvas = document.getElementById('modalRoRCanvas');
  const durationCanvas = document.getElementById('modalDurationCanvas');
  const maeMfeCanvas = document.getElementById('modalMaeMfeCanvas');
  const advancedContainer = document.getElementById('advancedStatsContainer');
  const tradesContainer = document.getElementById('tradesContainer');

  const { displayName } = getIdentity(account, index);
  title.textContent = displayName;
  ensureTrades(account);
  const { totalDeposit, totalProfit, profitThisMonth, growthPct } = computeMetrics(account);
  kpis.innerHTML = '';
  kpis.append(
    el('div', { class: 'kpi' }, [document.createTextNode('Depósito: '), el('strong', { text: currencyFormatter.format(totalDeposit) })]),
    el('div', { class: 'kpi' }, [document.createTextNode('Lucro (mês): '), el('strong', { text: currencyFormatter.format(profitThisMonth) })]),
    el('div', { class: 'kpi' }, [document.createTextNode('Lucro total: '), el('strong', { text: currencyFormatter.format(totalProfit) })]),
    el('div', { class: 'kpi' }, [document.createTextNode('Crescimento: '), el('strong', { text: percentFormatter.format(growthPct) })])
  );

  const renderMetric = () => {
    const s = buildAllSeries(account);
    const map = {
      profit: { data: s.profit, label: 'Lucro mensal (R$)', type: 'bar', yFmt: (v) => currencyFormatter.format(v) },
      balance: { data: s.balance, label: 'Saldo (R$)', type: 'line', yFmt: (v) => currencyFormatter.format(v) },
      equity: { data: s.equity, label: 'Equidade (R$)', type: 'line', yFmt: (v) => currencyFormatter.format(v) },
      growth: { data: s.growthPct.map(v => v * 100), label: 'Crescimento (%)', type: 'line', yFmt: (v) => `${v.toFixed(2)}%` },
      drawdown: { data: s.drawdownPct.map(v => v * 100), label: 'Drawdown (%)', type: 'line', yFmt: (v) => `${v.toFixed(2)}%` },
    };
    const key = metricSelect ? metricSelect.value : 'equity';
    const cfg = map[key];
    destroyModalCharts();
    modalMainChart = new Chart(mainCanvas.getContext('2d'), {
      type: cfg.type,
      data: { labels: s.labels, datasets: [{ label: cfg.label, data: cfg.data, borderColor: 'rgba(138,180,255,1)', backgroundColor: cfg.type === 'bar' ? 'rgba(31,111,235,0.8)' : 'rgba(138,180,255,0.15)', fill: cfg.type !== 'bar', tension: 0.25, borderWidth: 2, pointRadius: 0 }]},
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { ticks: { color: '#a4b1c9', callback: (v) => cfg.yFmt(Number(v)) }, grid: { color: 'rgba(255,255,255,0.06)' } } }, plugins: { legend: { labels: { color: '#e8f0ff' } } } }
    });
  };
  if (metricSelect) {
    metricSelect.value = 'equity';
    metricSelect.onchange = renderMetric;
  }
  renderMetric();

  // Render other sections
  renderAdvancedStats(account, advancedContainer);
  renderTradesTable(account, tradesContainer);
  renderAnalyticsCharts(account, { hourlyCanvas, dailyCanvas, rorCanvas, durationCanvas, maeMfeCanvas });

  // Tabs behavior
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = {
    analytics: document.getElementById('tabpanel-analytics'),
    advanced: document.getElementById('tabpanel-advanced'),
    trades: document.getElementById('tabpanel-trades')
  };
  const activate = (key) => {
    Object.entries(panels).forEach(([k, elp]) => {
      if (!elp) return;
      if (k === key) elp.removeAttribute('hidden');
      else elp.setAttribute('hidden', '');
    });
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === key ? 'true' : 'false'));
  };
  tabs.forEach(t => t.onclick = () => activate(t.dataset.tab));
  activate('advanced');

  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
  const onKey = (e) => { if (e.key === 'Escape') { closeModal(); } };
  const closeModal = () => {
    destroyModalCharts();
    modal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
  };
  // attach temp handlers
  modal.dataset.escBound = '1';
  document.addEventListener('keydown', onKey);
  const closeBtn = document.getElementById('accountModalClose');
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function wireModalClose() { /* Close handlers are attached per-open to also unlock scroll */ }

// ========== Profile sections renderers ==========
function renderAdvancedStats(account, container) {
  if (!container) return;
  container.innerHTML = '';
  let adv = account.stats && account.stats.advanced ? account.stats.advanced : null;
  if (!adv) {
    const trades = ensureTrades(account);
    adv = deriveAdvancedFromTrades(trades);
  }

  // Two-column table matching provided screenshot
  const table = el('table', { class: 'data-table' });
  const tbody = el('tbody');

  const winPct = Math.round((adv.longsWon.won + adv.shortsWon.won) / (adv.longsWon.total + adv.shortsWon.total) * 100);
  const profitabilityRow = () => {
    const barWrap = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
    const bar = el('div', { style: 'flex:1;height:10px;background:#2a3342;border-radius:999px;overflow:hidden;' });
    const green = el('div', { style: `height:100%;width:${winPct}%;background:#17c964;float:left;` });
    const red = el('div', { style: `height:100%;width:${100-winPct}%;background:#f31260;float:left;` });
    bar.appendChild(green); bar.appendChild(red);
    barWrap.appendChild(bar);
    return barWrap;
  };

  const row = (leftLabel, leftValue, rightLabel, rightValue) => {
    const tr = el('tr');
    tr.appendChild(el('td', { text: leftLabel }));
    const tdL = el('td');
    if (leftLabel === 'Profitability:') tdL.appendChild(profitabilityRow()); else tdL.textContent = leftValue;
    tr.appendChild(tdL);
    tr.appendChild(el('td', { text: rightLabel }));
    tr.appendChild(el('td', { text: rightValue }));
    return tr;
  };

  tbody.appendChild(row('Trades:', String(adv.trades), 'Longs Won:', `(${adv.longsWon.won}/${adv.longsWon.total}) ${Math.round(adv.longsWon.won/adv.longsWon.total*100)}%`));
  tbody.appendChild(row('Profitability:', '', 'Shorts Won:', `(${adv.shortsWon.won}/${adv.shortsWon.total}) ${Math.round(adv.shortsWon.won/adv.shortsWon.total*100)}%`));
  tbody.appendChild(row('Pips:', String(adv.pips), 'Best Trade (CNT):', `(${adv.bestTradeCurrency.date}) ${currencyFormatter.format(adv.bestTradeCurrency.value)}`));
  tbody.appendChild(row('Average Win:', `${adv.avgWinPips} pips / ${currencyFormatter.format(adv.avgWinCurrency)}`, 'Worst Trade (CNT):', `(${adv.worstTradeCurrency.date}) ${currencyFormatter.format(adv.worstTradeCurrency.value)}`));
  tbody.appendChild(row('Average Loss:', `${adv.avgLossPips} pips / ${currencyFormatter.format(adv.avgLossCurrency)}`, 'Best Trade (Pips):', `(${adv.bestTradePips.date}) ${adv.bestTradePips.value}`));
  tbody.appendChild(row('Lots :', String(adv.lots), 'Worst Trade (Pips):', `(${adv.worstTradePips.date}) ${adv.worstTradePips.value}`));
  tbody.appendChild(row('Commissions:', currencyFormatter.format(adv.commissions), 'Avg. Trade Length:', adv.avgTradeLength));
  tbody.appendChild(row('', '', 'Profit Factor:', String(adv.profitFactor)));
  tbody.appendChild(row('', '', 'Standard Deviation:', currencyFormatter.format(adv.stdDev)));
  tbody.appendChild(row('', '', 'Sharpe Ratio', String(adv.sharpe)));
  tbody.appendChild(row('', '', 'Z-Score (Probability):', `${adv.zScore.value} (${adv.zScore.probability}%)`));
  tbody.appendChild(row('', '', 'Expectancy', `${adv.expectancy.pips} Pips / ${currencyFormatter.format(adv.expectancy.currency)}`));
  tbody.appendChild(row('', '', 'AHPR:', `${adv.ahpr}%`));
  tbody.appendChild(row('', '', 'GHPR:', `${adv.ghpr}%`));

  table.appendChild(tbody);
  container.appendChild(table);
}

// Info tab removed as per request

function renderTradesTable(account, container) {
  if (!container) return;
  container.innerHTML = '';
  const trades = Array.isArray(account.trades) ? account.trades : [];
  if (!trades.length) { container.textContent = 'Sem histórico de trades.'; return; }

  // Summary KPIs
  const stats = computeTradeStats(trades);
  const summary = el('div', { class: 'kpi-row', style: 'margin-bottom:8px;' });
  const add = (label, value) => summary.appendChild(el('div', { class: 'kpi' }, [document.createTextNode(label + ': '), el('strong', { text: value })]));
  add('Trades', String(stats.total));
  add('Profitability', `${stats.profitabilityPct.toFixed(1)}%`);
  add('Avg Win', currencyFormatter.format(stats.avgWin));
  add('Avg Loss', currencyFormatter.format(stats.avgLoss));
  add('Profit Factor', stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2));
  add('Expectancy', currencyFormatter.format(stats.expectancy));
  container.appendChild(summary);

  // Small equity sparkline from trades profit
  const sparkWrap = el('div', { class: 'chart-wrap', style: 'height:90px; margin-bottom:8px;' });
  const sparkCanvas = el('canvas');
  sparkWrap.appendChild(sparkCanvas);
  container.appendChild(sparkWrap);
  let eq = 0; const eqSeries = trades.map(t => { eq += t.profit || 0; return eq; });
  const ch = new Chart(sparkCanvas.getContext('2d'), {
    type: 'line',
    data: { labels: eqSeries.map((_, i) => i + 1), datasets: [{ data: eqSeries, borderColor: 'rgba(138,180,255,1)', backgroundColor: 'rgba(138,180,255,0.12)', fill: true, tension: 0.25, borderWidth: 1.5, pointRadius: 0 }]},
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
  modalAuxCharts.push(ch);
  const table = el('table', { class: 'data-table' });
  const thead = el('thead', {}, [el('tr', {}, [
    el('th', { text: 'Date' }),
    el('th', { text: 'Symbol' }),
    el('th', { text: 'Side' }),
    el('th', { text: 'Lots' }),
    el('th', { text: 'Pips' }),
    el('th', { text: 'Profit' }),
    el('th', { text: 'Duration' })
  ])]);
  const tbody = el('tbody');
  trades.slice(0, 100).forEach(t => {
    const tr = el('tr', {}, [
      el('td', { text: t.date }),
      el('td', { text: t.symbol }),
      el('td', { text: t.side }),
      el('td', { text: String(t.lots) }),
      el('td', { text: String(t.pips) }),
      el('td', { text: currencyFormatter.format(t.profit) }),
      el('td', { text: `${Math.round((t.duration || 0) / 60)}h` })
    ]);
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderAnalyticsCharts(account, canvases) {
  const trades = Array.isArray(account.trades) ? account.trades : [];
  const hasTrades = trades.length > 0;
  // Hourly distribution (0-23)
  if (canvases.hourlyCanvas) {
    if (!hasTrades) { canvases.hourlyCanvas.parentElement.parentElement.style.display = 'none'; } else { canvases.hourlyCanvas.parentElement.parentElement.style.display = ''; }
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const arr = new Array(24).fill(0);
    trades.forEach(t => { if (typeof t.hour === 'number') arr[t.hour] += t.profit || 0; });
    const chart = new Chart(canvases.hourlyCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: hours.map(h => `${h}:00`), datasets: [{ label: 'Profit por hora', data: arr, backgroundColor: arr.map(v => v >= 0 ? 'rgba(31,111,235,0.8)' : 'rgba(243,18,96,0.8)') }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e8f0ff' } } }, scales: { x: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { ticks: { color: '#a4b1c9', callback: (v) => currencyFormatter.format(v) }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
    modalAuxCharts.push(chart);
  }
  // Daily (Mon-Sun)
  if (canvases.dailyCanvas) {
    if (!hasTrades) { canvases.dailyCanvas.parentElement.parentElement.style.display = 'none'; } else { canvases.dailyCanvas.parentElement.parentElement.style.display = ''; }
    const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const arr = new Array(7).fill(0);
    trades.forEach(t => { if (typeof t.weekday === 'number') arr[(t.weekday + 6) % 7] += t.profit || 0; });
    const chart = new Chart(canvases.dailyCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Profit por dia', data: arr, backgroundColor: arr.map(v => v >= 0 ? 'rgba(31,111,235,0.8)' : 'rgba(243,18,96,0.8)') }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e8f0ff' } } }, scales: { x: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { ticks: { color: '#a4b1c9', callback: (v) => currencyFormatter.format(v) }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
    modalAuxCharts.push(chart);
  }
  // Risk of Ruin (simple approximation: cumulative profit path variance)
  if (canvases.rorCanvas) {
    if (!hasTrades) { canvases.rorCanvas.parentElement.parentElement.style.display = 'none'; } else { canvases.rorCanvas.parentElement.parentElement.style.display = ''; }
    let equity = 0;
    const path = trades.map(t => { equity += t.profit || 0; return equity; });
    const peak = path.reduce((p, v) => Math.max(p, v), 0);
    const dd = path.map(v => peak ? (v - peak) / peak * 100 : 0);
    const chart = new Chart(canvases.rorCanvas.getContext('2d'), {
      type: 'line',
      data: { labels: path.map((_, i) => i + 1), datasets: [{ label: 'Drawdown %', data: dd, borderColor: 'rgba(243,18,96,1)', backgroundColor: 'rgba(243,18,96,0.15)', fill: true, tension: 0.25, pointRadius: 0 }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e8f0ff' } } }, scales: { x: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { ticks: { color: '#a4b1c9', callback: (v) => `${Number(v).toFixed(1)}%` }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
    modalAuxCharts.push(chart);
  }
  // Duration histogram
  if (canvases.durationCanvas) {
    if (!hasTrades) { canvases.durationCanvas.parentElement.parentElement.style.display = 'none'; } else { canvases.durationCanvas.parentElement.parentElement.style.display = ''; }
    const buckets = [30, 60, 120, 240, 480, 960, 1440, 2880];
    const arr = new Array(buckets.length).fill(0);
    trades.forEach(t => {
      const d = t.duration || 0; // minutes
      const idx = buckets.findIndex(b => d <= b);
      const i = idx === -1 ? buckets.length - 1 : idx;
      arr[i] += 1;
    });
    const chart = new Chart(canvases.durationCanvas.getContext('2d'), {
      type: 'bar',
      data: { labels: buckets.map(b => `≤ ${Math.round(b/60)}h`), datasets: [{ label: 'Nº de trades', data: arr, backgroundColor: 'rgba(138,180,255,0.8)' }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e8f0ff' } } }, scales: { x: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
    modalAuxCharts.push(chart);
  }
  // MAE/MFE scatter (pips)
  if (canvases.maeMfeCanvas) {
    const points = trades.filter(t => typeof t.maePips === 'number' && typeof t.mfePips === 'number')
      .map(t => ({ x: t.maePips, y: t.mfePips }));
    if (points.length === 0) { canvases.maeMfeCanvas.parentElement.parentElement.style.display = 'none'; return; } else { canvases.maeMfeCanvas.parentElement.parentElement.style.display = ''; }
    const chart = new Chart(canvases.maeMfeCanvas.getContext('2d'), {
      type: 'scatter',
      data: { datasets: [{ label: 'MAE/MFE (pips)', data: points, pointBackgroundColor: 'rgba(31,111,235,0.9)' }]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e8f0ff' } } }, scales: { x: { title: { display: true, text: 'MAE (pips)', color: '#a4b1c9' }, ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } }, y: { title: { display: true, text: 'MFE (pips)', color: '#a4b1c9' }, ticks: { color: '#a4b1c9' }, grid: { color: 'rgba(255,255,255,0.06)' } } } }
    });
    modalAuxCharts.push(chart);
  }
}

async function bootstrap() {
  try {
    const data = await loadAccounts();
    renderTable(data.accounts);
    renderCharts(data.accounts);
  } catch (e) {
    console.error(e);
    alert('Não foi possível carregar os dados. Verifique o arquivo data/accounts.json');
  }
}

document.getElementById('refreshBtn').addEventListener('click', bootstrap);
wireModalClose();
bootstrap();


