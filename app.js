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
          el('button', { class: 'btn secondary open-profile', 'data-index': String(index), text: 'Ver perfil' })
      ])
    ]);

    tbody.appendChild(tr);

  });

  // Delegate clicks for profile open
  tbody.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('open-profile')) {
      const idx = Number(target.getAttribute('data-index'));
      const selected = accounts[idx];
      if (selected) openAccountModal(selected, idx);
    }
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
      el('button', { class: 'btn secondary open-profile-card', 'data-index': String(index), text: 'Ver perfil' })
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

    // Open modal handler via delegation on grid
  });

  // Delegate clicks for cards
  grid.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('open-profile-card')) {
      const idx = Number(target.getAttribute('data-index'));
      const selected = accounts[idx];
      if (selected) openAccountModal(selected, idx);
    }
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
  const trades = ensureTrades(account);
  const adv = deriveAdvancedFromTrades(trades);

  // Two-column table matching provided screenshot
  const table = el('table', { class: 'data-table' });
  const tbody = el('tbody');

  const totalForWin = ((adv.longsWon && adv.longsWon.total) || 0) + ((adv.shortsWon && adv.shortsWon.total) || 0);
  const winsCount = ((adv.longsWon && adv.longsWon.won) || 0) + ((adv.shortsWon && adv.shortsWon.won) || 0);
  const winPct = totalForWin > 0 ? Math.round((winsCount / totalForWin) * 100) : 0;
  const profitabilityRow = () => {
    // Colored band: left green (wins), right red (losses) + colored percentage chip
    const barWrap = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
    const bar = el('div', { style: 'flex:1;height:10px;background:#2a3342;border-radius:999px;overflow:hidden;' });
    const clamped = Math.max(0, Math.min(100, winPct));
    const green = el('div', { style: `height:100%;width:${clamped}%;background:#17c964;float:left;` });
    const red = el('div', { style: `height:100%;width:${100 - clamped}%;background:#f31260;float:left;` });
    bar.appendChild(green); bar.appendChild(red);
    const chipColor = winPct >= 60 ? '#17c964' : (winPct >= 40 ? '#f5a524' : '#f31260');
    const chipBg = winPct >= 60 ? 'rgba(23,201,100,0.15)' : (winPct >= 40 ? 'rgba(245,165,36,0.15)' : 'rgba(243,18,96,0.15)');
    const chip = el('span', { style: `min-width:48px;text-align:center;padding:2px 8px;border-radius:999px;font-weight:600;color:${chipColor};background:${chipBg};` , text: `${winPct}%` });
    barWrap.appendChild(bar);
    barWrap.appendChild(chip);
    return barWrap;
  };

  const row = (leftLabel, leftValue, rightLabel, rightValue) => {
    const tr = el('tr');
    tr.appendChild(el('td', { text: leftLabel }));
    const tdL = el('td');
    const key = String(leftLabel || '').toLowerCase();
    if (key.includes('profit') || key.includes('lucrat')) tdL.appendChild(profitabilityRow()); else tdL.textContent = leftValue;
    tr.appendChild(tdL);
    tr.appendChild(el('td', { text: rightLabel }));
    tr.appendChild(el('td', { text: rightValue }));
    return tr;
  };

  tbody.appendChild(row('Operações:', String(adv.trades), 'Longos vencedores:', `(${adv.longsWon.won}/${adv.longsWon.total}) ${Math.round(adv.longsWon.won/adv.longsWon.total*100)}%`));
  tbody.appendChild(row('Lucratividade:', '', 'Curtos vencedores:', `(${adv.shortsWon.won}/${adv.shortsWon.total}) ${Math.round(adv.shortsWon.won/adv.shortsWon.total*100)}%`));
  tbody.appendChild(row('Pips:', String(adv.pips), 'Melhor trade (R$):', `(${adv.bestTradeCurrency.date}) ${currencyFormatter.format(adv.bestTradeCurrency.value)}`));
  tbody.appendChild(row('Ganho médio:', `${adv.avgWinPips} pips / ${currencyFormatter.format(adv.avgWinCurrency)}`, 'Pior trade (R$):', `(${adv.worstTradeCurrency.date}) ${currencyFormatter.format(adv.worstTradeCurrency.value)}`));
  tbody.appendChild(row('Perda média:', `${adv.avgLossPips} pips / ${currencyFormatter.format(adv.avgLossCurrency)}`, 'Melhor trade (pips):', `(${adv.bestTradePips.date}) ${adv.bestTradePips.value}`));
  tbody.appendChild(row('Lotes:', String(adv.lots), 'Pior trade (pips):', `(${adv.worstTradePips.date}) ${adv.worstTradePips.value}`));
  tbody.appendChild(row('Comissões:', currencyFormatter.format(adv.commissions), 'Duração média:', adv.avgTradeLength));
  tbody.appendChild(row('', '', 'Fator de lucro:', String(adv.profitFactor)));
  tbody.appendChild(row('', '', 'Desvio padrão:', currencyFormatter.format(adv.stdDev)));
  tbody.appendChild(row('', '', 'Índice de Sharpe', String(adv.sharpe)));
  tbody.appendChild(row('', '', 'Z-Score (Probabilidade):', `${adv.zScore.value} (${adv.zScore.probability}%)`));
  tbody.appendChild(row('', '', 'Expectativa', `${adv.expectancy.pips} Pips / ${currencyFormatter.format(adv.expectancy.currency)}`));
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
    el('th', { text: 'Data' }),
    el('th', { text: 'Símbolo' }),
    el('th', { text: 'Direção' }),
    el('th', { text: 'Lotes' }),
    el('th', { text: 'Pips' }),
    el('th', { text: 'Lucro' }),
    el('th', { text: 'Duração' })
  ])]);
  const tbody = el('tbody');
  trades.slice(0, 100).forEach(t => {
    const tr = el('tr', {}, [
      el('td', { text: t.date }),
      el('td', { text: t.symbol }),
      el('td', { text: t.side === 'buy' ? 'Compra' : 'Venda' }),
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

// ========== ADMIN PANEL FUNCTIONALITY ==========

// Configuration admin
const ADMIN_PASSWORD = 'admin123'; // Mot de passe par défaut - à changer en production
let isAdminAuthenticated = false;
let accountsData = null;

// Fonction pour afficher le lien admin
function showAdminLink() {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) {
    adminLink.style.display = 'block';
  }
}

// Fonction pour masquer le lien admin
function hideAdminLink() {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) {
    adminLink.style.display = 'none';
  }
}

// Authentification admin
function authenticateAdmin(password) {
  return password === ADMIN_PASSWORD;
}

// Ouvrir le modal d'authentification
function openAdminAuth() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) {
    modal.removeAttribute('hidden');
    document.body.classList.add('modal-open');
    document.getElementById('adminPassword').focus();
  }
}

// Fermer le modal d'authentification
function closeAdminAuth() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) {
    modal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    document.getElementById('adminPassword').value = '';
  }
}

// Ouvrir le panneau admin
function openAdminPanel() {
  const modal = document.getElementById('adminPanelModal');
  if (modal) {
    modal.removeAttribute('hidden');
    document.body.classList.add('modal-open');
    loadAdminData();
  }
}

// Fermer le panneau admin
function closeAdminPanel() {
  const modal = document.getElementById('adminPanelModal');
  if (modal) {
    modal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
  }
}

// Charger les données pour l'admin
async function loadAdminData() {
  try {
    const data = await loadAccounts();
    accountsData = data;
    renderAdminAccountsTable(data.accounts);
    populateAccountSelector(data.accounts);
  } catch (error) {
    console.error('Erreur lors du chargement des données admin:', error);
    alert('Erreur lors du chargement des données');
  }
}

// Rendre le tableau des comptes admin (pt-BR)
function renderAdminAccountsTable(accounts) {
  const tbody = document.getElementById('adminAccountsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  accounts.forEach((account, index) => {
    const tr = document.createElement('tr');
    
    // Statistiques avancées
    // On calcule les statistiques à partir des trades pour être sûr d'avoir des données à jour
    const trades = ensureTrades(account);
    const stats = deriveAdvancedFromTrades(trades);
    const statsText = `
      <div class="stats-summary">
        <div><strong>Operações:</strong> ${stats.trades || 0}</div>
        <div><strong>Pips:</strong> ${stats.pips || 0}</div>
        <div><strong>Fator de Lucro:</strong> ${stats.profitFactor || 0}</div>
        <div><strong>Lotes:</strong> ${stats.lots || 0}</div>
      </div>
    `;
    
    tr.innerHTML = `
      <td>
        <input type="text" class="edit-input" value="${account.personName || ''}" 
               data-field="personName" data-index="${index}">
      </td>
      <td>
        <input type="text" class="edit-input" value="${account.name || ''}" 
               data-field="name" data-index="${index}">
      </td>
      <td>
        <input type="number" class="edit-input" value="${account.totalDeposit || 0}" 
               data-field="totalDeposit" data-index="${index}">
      </td>
      <td>
        <div class="stats-editor">
          <div class="stats-row">
            <label>Operações:</label>
            <input type="number" class="edit-input small" value="${stats.trades || 0}" 
                   data-field="stats.advanced.trades" data-index="${index}">
          </div>
          <div class="stats-row">
            <label>Pips:</label>
            <input type="number" class="edit-input small" value="${stats.pips || 0}" 
                   data-field="stats.advanced.pips" data-index="${index}">
          </div>
          <div class="stats-row">
            <label>Fator de Lucro:</label>
            <input type="number" class="edit-input small" value="${stats.profitFactor || 0}" 
                   data-field="stats.advanced.profitFactor" data-index="${index}">
          </div>
          <div class="stats-row">
            <label>Lots:</label>
            <input type="number" class="edit-input small" value="${stats.lots || 0}" 
                   data-field="stats.advanced.lots" data-index="${index}">
          </div>
        </div>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn small secondary" onclick="editAccountDetails(${index})">Detalhes</button>
          <button class="btn small danger" onclick="deleteAccount(${index})">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Rendre le tableau des données mensuelles
function renderMonthlyTable(accountIndex) {
  const tbody = document.getElementById('monthlyDataTableBody');
  if (!tbody || !accountsData) return;
  
  const account = accountsData.accounts[accountIndex];
  const monthly = account.monthly || [];
  
  tbody.innerHTML = '';
  
  monthly.forEach((month, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="edit-input" value="${month.month}" 
               data-field="month" data-account="${accountIndex}" data-month="${index}">
      </td>
      <td>
        <input type="number" class="edit-input" value="${month.profit}" 
               data-field="profit" data-account="${accountIndex}" data-month="${index}">
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn small danger" onclick="deleteMonthlyData(${accountIndex}, ${index})">Supprimer</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Remplir le sélecteur de comptes
function populateAccountSelector(accounts) {
  const selector = document.getElementById('accountSelector');
  if (!selector) return;
  
  selector.innerHTML = '<option value="">Choisir un compte...</option>';
  accounts.forEach((account, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = account.name || account.personName || `Compte ${index + 1}`;
    selector.appendChild(option);
  });
}

// Ajouter un nouveau compte
function addNewAccount() {
  if (!accountsData) return;
  
  const newAccount = {
    personName: 'Nuevo trader',
    name: 'Nueva cuenta',
    totalDeposit: 10000,
    monthly: []
  };
  
  accountsData.accounts.push(newAccount);
  renderAdminAccountsTable(accountsData.accounts);
  populateAccountSelector(accountsData.accounts);
}

// Supprimer un compte
function deleteAccount(index) {
  if (!accountsData || !confirm('¿Está seguro de que desea eliminar esta cuenta?')) return;
  
  accountsData.accounts.splice(index, 1);
  renderAdminAccountsTable(accountsData.accounts);
  populateAccountSelector(accountsData.accounts);
}

// Ajouter des données mensuelles
function addMonthlyData() {
  const selector = document.getElementById('accountSelector');
  const accountIndex = parseInt(selector.value);
  
  if (accountIndex === '' || !accountsData) return;
  
  const account = accountsData.accounts[accountIndex];
  if (!account.monthly) account.monthly = [];
  
  const currentDate = new Date();
  const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  account.monthly.push({
    month: month,
    profit: 0
  });
  
  renderMonthlyTable(accountIndex);
}

// Supprimer des données mensuelles
function deleteMonthlyData(accountIndex, monthIndex) {
  if (!accountsData || !confirm('¿Está seguro de que desea eliminar estos datos?')) return;
  
  accountsData.accounts[accountIndex].monthly.splice(monthIndex, 1);
  renderMonthlyTable(accountIndex);
}

// Éditer les détails d'un compte (inclui estatísticas e histórico de operações)
function editAccountDetails(accountIndex) {
  if (!accountsData || !accountsData.accounts[accountIndex]) return;
  
  const account = accountsData.accounts[accountIndex];
  const stats = account.stats?.advanced || {};
  
  // Créer un modal de détails
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-dialog" style="max-width: 980px;">
      <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button>
      <div class="modal-header">
        <h3>Detalhes da conta: ${account.personName || 'N/A'}</h3>
      </div>
      <div class="modal-body">
        <div class="account-details">
          <div class="detail-section">
            <h4>Informações básicas</h4>
            <div class="detail-row">
              <label>Nome da pessoa:</label>
              <input type="text" class="edit-input" value="${account.personName || ''}" 
                     data-field="personName" data-index="${accountIndex}">
            </div>
            <div class="detail-row">
              <label>Nome da conta:</label>
              <input type="text" class="edit-input" value="${account.name || ''}" 
                     data-field="name" data-index="${accountIndex}">
            </div>
            <div class="detail-row">
              <label>Depósito total:</label>
              <input type="number" class="edit-input" value="${account.totalDeposit || 0}" 
                     data-field="totalDeposit" data-index="${accountIndex}">
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Estatísticas avançadas</h4>
            <div class="stats-grid">
              <div class="detail-row">
                <label>Operações:</label>
                <input type="number" class="edit-input" value="${stats.trades || 0}" 
                       data-field="stats.advanced.trades" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Pips:</label>
                <input type="number" class="edit-input" value="${stats.pips || 0}" 
                       data-field="stats.advanced.pips" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Fator de Lucro:</label>
                <input type="number" class="edit-input" value="${stats.profitFactor || 0}" 
                       data-field="stats.advanced.profitFactor" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Lots:</label>
                <input type="number" class="edit-input" value="${stats.lots || 0}" 
                       data-field="stats.advanced.lots" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Comissões:</label>
                <input type="number" class="edit-input" value="${stats.commissions || 0}" 
                       data-field="stats.advanced.commissions" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Lucros médios (moeda):</label>
                <input type="number" class="edit-input" value="${stats.avgWinCurrency || 0}" 
                       data-field="stats.advanced.avgWinCurrency" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Perdas médias (moeda):</label>
                <input type="number" class="edit-input" value="${stats.avgLossCurrency || 0}" 
                       data-field="stats.advanced.avgLossCurrency" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Expectativa (moeda):</label>
                <input type="number" class="edit-input" value="${(stats.expectancy && stats.expectancy.currency) || 0}" 
                       data-field="stats.advanced.expectancy.currency" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>Expectativa (pips):</label>
                <input type="number" class="edit-input" value="${(stats.expectancy && stats.expectancy.pips) || 0}" 
                       data-field="stats.advanced.expectancy.pips" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>AHPR:</label>
                <input type="number" class="edit-input" value="${stats.ahpr || 0}" 
                       data-field="stats.advanced.ahpr" data-index="${accountIndex}">
              </div>
              <div class="detail-row">
                <label>GHPR:</label>
                <input type="number" class="edit-input" value="${stats.ghpr || 0}" 
                       data-field="stats.advanced.ghpr" data-index="${accountIndex}">
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h4>Histórico de operações</h4>
            <div class="admin-table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ativo</th>
                    <th>Direção</th>
                    <th>Lotes</th>
                    <th>Pips</th>
                    <th>Lucro</th>
                    <th>Duração (min)</th>
                    <th>MAE</th>
                    <th>MFE</th>
                    <th>Hora</th>
                    <th>Dia</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="tradesTableBody">
                  ${(Array.isArray(account.trades) ? account.trades : []).map((t, i) => `
                    <tr>
                      <td><input class="edit-input small" type="text" value="${t.date || ''}" data-field="trade.date" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="text" value="${t.symbol || ''}" data-field="trade.symbol" data-trade="${i}"></td>
                      <td>
                        <select class="edit-input small" data-field="trade.side" data-trade="${i}">
                          <option value="buy" ${t.side==='buy'?'selected':''}>Compra</option>
                          <option value="sell" ${t.side==='sell'?'selected':''}>Venda</option>
                        </select>
                      </td>
                      <td><input class="edit-input small" type="number" step="0.01" value="${t.lots || 0}" data-field="trade.lots" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" step="0.1" value="${t.pips || 0}" data-field="trade.pips" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" step="0.01" value="${t.profit || 0}" data-field="trade.profit" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" value="${t.duration || 0}" data-field="trade.duration" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" step="0.1" value="${t.maePips || 0}" data-field="trade.maePips" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" step="0.1" value="${t.mfePips || 0}" data-field="trade.mfePips" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" value="${t.hour ?? ''}" data-field="trade.hour" data-trade="${i}"></td>
                      <td><input class="edit-input small" type="number" value="${t.weekday ?? ''}" data-field="trade.weekday" data-trade="${i}"></td>
                      <td><button class="btn small danger" onclick="deleteTradeRow(${accountIndex}, ${i}, this)">Excluir</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="form-actions">
              <button class="btn" onclick="addTradeRow(${accountIndex}, this)">Adicionar operação</button>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn primary" onclick="saveAccountDetails(${accountIndex}); this.closest('.modal-backdrop').remove();">Salvar</button>
          <button class="btn secondary" onclick="this.closest('.modal-backdrop').remove();">Cancelar</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
}

// Sauvegarder les détails d'un compte
// Sauvegarder les détails d'un compte
function saveAccountDetails(accountIndex) {
  if (!accountsData || !accountsData.accounts[accountIndex]) return;
  
  // Mettre à jour les données depuis les inputs du modal
  const modal = document.querySelector('.modal-backdrop');
  const inputs = modal.querySelectorAll('input[data-field], select[data-field]');
  
  inputs.forEach(input => {
    const field = input.dataset.field;
    const value = input.value;
    
    if (field === 'totalDeposit') {
      accountsData.accounts[accountIndex][field] = parseFloat(value) || 0;
    } else if (field === 'personName' || field === 'name') {
      accountsData.accounts[accountIndex][field] = value;
    } else if (field.startsWith('stats.advanced.')) {
      const statField = field.replace('stats.advanced.', '');
      if (!accountsData.accounts[accountIndex].stats) {
        accountsData.accounts[accountIndex].stats = { advanced: {} };
      }
      if (!accountsData.accounts[accountIndex].stats.advanced) {
        accountsData.accounts[accountIndex].stats.advanced = {};
      }
      // nested expectancy fields
      if (statField.startsWith('expectancy.')) {
        const key = statField.split('.')[1];
        if (!accountsData.accounts[accountIndex].stats.advanced.expectancy) {
          accountsData.accounts[accountIndex].stats.advanced.expectancy = { pips: 0, currency: 0 };
        }
        accountsData.accounts[accountIndex].stats.advanced.expectancy[key] = parseFloat(value) || 0;
      } else {
        accountsData.accounts[accountIndex].stats.advanced[statField] = parseFloat(value) || 0;
      }
    } else if (field.startsWith('trade.')) {
      const tradeIndex = parseInt(input.dataset.trade);
      const key = field.replace('trade.', '');
      if (!Array.isArray(accountsData.accounts[accountIndex].trades)) {
        accountsData.accounts[accountIndex].trades = [];
      }
      const t = accountsData.accounts[accountIndex].trades[tradeIndex] || {};
      if (['lots','pips','profit','duration','maePips','mfePips','hour','weekday'].includes(key)) {
        t[key] = input.value === '' ? null : parseFloat(input.value);
      } else if (key === 'side') {
        t[key] = input.value === 'sell' ? 'sell' : 'buy';
      } else {
        t[key] = input.value;
      }
      // simple id fallback
      if (!t.id) t.id = `E${String(tradeIndex+1).padStart(3,'0')}`;
      accountsData.accounts[accountIndex].trades[tradeIndex] = t;
    }
  });
  
  // Recharger le tableau principal en arrière-plan pour refléter les changements
  renderAdminAccountsTable(accountsData.accounts);
  
  // --- BLOC DE SAUVEGARDE AJOUTÉ DIRECTEMENT ICI ---
  (async () => {
    try {
      const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountsData)
      };
      let ok = false;
      try {
        const response = await fetch('/save-data', payload);
        ok = response.ok && (await response.json()).success === true;
      } catch {}
      if (!ok) {
        try {
          const response2 = await fetch('http://localhost:8001/save-data', payload);
          ok = response2.ok && (await response2.json()).success === true;
        } catch {}
      }
      if (ok) {
        alert('✅ ¡Detalles guardados con éxito!');
        // Recharger les données publiques pour voir les changements
        const data = await loadAccounts();
        renderTable(data.accounts);
        renderCharts(data.accounts);
      } else {
        alert('❌ Erreur lors de la sauvegarde. Vérifiez le serveur admin.');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des détails:', error);
      alert('❌ Erreur lors de la sauvegarde. Vérifiez que le serveur admin est démarré.');
    }
  })();
}
// Adicionar/remover linhas de operações
function addTradeRow(accountIndex, btn) {
  if (!accountsData || !accountsData.accounts[accountIndex]) return;
  if (!Array.isArray(accountsData.accounts[accountIndex].trades)) {
    accountsData.accounts[accountIndex].trades = [];
  }
  const trades = accountsData.accounts[accountIndex].trades;
  trades.push({ date: '', symbol: '', side: 'buy', lots: 0, pips: 0, profit: 0, duration: 0 });
  // re-open modal to refresh table quickly
  btn.closest('.modal-backdrop').remove();
  editAccountDetails(accountIndex);
}

function deleteTradeRow(accountIndex, tradeIndex, btn) {
  if (!accountsData || !accountsData.accounts[accountIndex]) return;
  const trades = accountsData.accounts[accountIndex].trades || [];
  trades.splice(tradeIndex, 1);
  btn.closest('tr').remove();
}

// Sauvegarder les modifications
async function saveAdminChanges() {
  if (!accountsData) return;
  
  try {
    // Mettre à jour les données depuis les inputs
    updateDataFromInputs();
    
    // Sauvegarder via le serveur (tentativa no mesmo host, fallback 8001)
    const payload = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountsData)
    };
    let ok = false;
    try {
      const response = await fetch('/save-data', payload);
      ok = response.ok && (await response.json()).success === true;
    } catch {}
    if (!ok) {
      try {
        const response2 = await fetch('http://localhost:8001/save-data', payload);
        ok = response2.ok && (await response2.json()).success === true;
      } catch {}
    }
    if (ok) {
      alert('✅ Données sauvegardées avec succès !');
      // Recharger les données pour voir les changements
      const data = await loadAccounts();
      renderTable(data.accounts);
      renderCharts(data.accounts);
    } else {
      alert('❌ Erreur lors de la sauvegarde. Vérifiez le serveur admin.');
    }
    
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    alert('❌ Erreur lors de la sauvegarde. Vérifiez que le serveur admin est démarré.');
  }
}

// Mettre à jour les données depuis les inputs
function updateDataFromInputs() {
  if (!accountsData) return;
  
  // Mettre à jour les comptes
  const accountInputs = document.querySelectorAll('#adminAccountsTableBody input[data-field]');
  accountInputs.forEach(input => {
    const field = input.dataset.field;
    const index = parseInt(input.dataset.index);
    
    if (accountsData.accounts[index]) {
      // Gérer les champs simples
      if (field === 'totalDeposit') {
        accountsData.accounts[index][field] = parseFloat(input.value) || 0;
      } else if (field === 'personName' || field === 'name') {
        accountsData.accounts[index][field] = input.value;
      }
      // Gérer les statistiques avancées
      else if (field.startsWith('stats.advanced.')) {
        const statField = field.replace('stats.advanced.', '');
        if (!accountsData.accounts[index].stats) {
          accountsData.accounts[index].stats = { advanced: {} };
        }
        if (!accountsData.accounts[index].stats.advanced) {
          accountsData.accounts[index].stats.advanced = {};
        }
        
        const value = parseFloat(input.value) || 0;
        accountsData.accounts[index].stats.advanced[statField] = value;
      }
    }
  });
  
  // Mettre à jour les données mensuelles
  const monthlyInputs = document.querySelectorAll('#monthlyDataTableBody input[data-field]');
  monthlyInputs.forEach(input => {
    const field = input.dataset.field;
    const accountIndex = parseInt(input.dataset.account);
    const monthIndex = parseInt(input.dataset.month);
    
    if (accountsData.accounts[accountIndex] && accountsData.accounts[accountIndex].monthly[monthIndex]) {
      if (field === 'profit') {
        accountsData.accounts[accountIndex].monthly[monthIndex][field] = parseFloat(input.value) || 0;
      } else {
        accountsData.accounts[accountIndex].monthly[monthIndex][field] = input.value;
      }
    }
  });
}

// Gestion des onglets admin
function switchAdminTab(tabName) {
  // Masquer tous les onglets
  document.querySelectorAll('.admin-tab-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  
  // Désactiver tous les boutons d'onglet
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Afficher l'onglet sélectionné
  const targetPanel = document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
  const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
  
  if (targetPanel) targetPanel.style.display = 'block';
  if (targetBtn) targetBtn.classList.add('active');
}

// Initialisation des événements admin
function initAdminEvents() {
  // Lien admin
  const adminLink = document.getElementById('adminLink');
  if (adminLink) {
    adminLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminAuth();
    });
  }
  
  // Formulaire d'authentification
  const authForm = document.getElementById('adminAuthForm');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = document.getElementById('adminPassword').value;
      
      if (authenticateAdmin(password)) {
        isAdminAuthenticated = true;
        closeAdminAuth();
        openAdminPanel();
        showAdminLink();
      } else {
        alert('Mot de passe incorrect');
      }
    });
  }
  
  // Boutons d'annulation
  const cancelAuth = document.getElementById('cancelAuth');
  if (cancelAuth) {
    cancelAuth.addEventListener('click', closeAdminAuth);
  }
  
  const adminAuthClose = document.getElementById('adminAuthClose');
  if (adminAuthClose) {
    adminAuthClose.addEventListener('click', closeAdminAuth);
  }
  
  const adminPanelClose = document.getElementById('adminPanelClose');
  if (adminPanelClose) {
    adminPanelClose.addEventListener('click', closeAdminPanel);
  }
  
  // Boutons du panneau admin
  const addAccountBtn = document.getElementById('addAccountBtn');
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', addNewAccount);
  }
  
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  if (saveChangesBtn) {
    saveChangesBtn.addEventListener('click', saveAdminChanges);
  }
  
  const addMonthlyBtn = document.getElementById('addMonthlyBtn');
  if (addMonthlyBtn) {
    addMonthlyBtn.addEventListener('click', addMonthlyData);
  }
  
  // Sélecteur de compte
  const accountSelector = document.getElementById('accountSelector');
  if (accountSelector) {
    accountSelector.addEventListener('change', (e) => {
      const accountIndex = parseInt(e.target.value);
      const container = document.getElementById('monthlyDataContainer');
      
      if (accountIndex !== '' && container) {
        container.style.display = 'block';
        renderMonthlyTable(accountIndex);
      } else if (container) {
        container.style.display = 'none';
      }
    });
  }
  
  // Onglets admin
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchAdminTab(tabName);
    });
  });
  
  // Fermeture des modales au clic sur le backdrop
  const authModal = document.getElementById('adminAuthModal');
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAdminAuth();
    });
  }
  
  const panelModal = document.getElementById('adminPanelModal');
  if (panelModal) {
    panelModal.addEventListener('click', (e) => {
      if (e.target === panelModal) closeAdminPanel();
    });
  }
}

// Initialiser les événements admin
initAdminEvents();

// TEMPORAIRE : Afficher le lien admin pour les tests
// À supprimer en production
showAdminLink();


