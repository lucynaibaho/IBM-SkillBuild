/**
 * script.js — Sales Dashboard 2023
 * Memuat data dari sales_data.json, mengelola filter global,
 * menghitung KPI, dan merender 10 chart menggunakan Chart.js.
 */

/* ─────────────────────────────────────────────────────────────
   KONSTANTA & PALET WARNA KONSISTEN
───────────────────────────────────────────────────────────── */
const PALETTE = {
  primary:   '#3b82d4',
  secondary: '#7c5cd8',
  accent:    '#10b981',
  warn:      '#f59e0b',
  danger:    '#ef4444',
  muted:     '#94a3b8',
  // Palet multi-warna untuk chart batang & pie
  multi: [
    '#3b82d4', '#7c5cd8', '#10b981', '#f59e0b',
    '#ef4444', '#06b6d4', '#f97316', '#84cc16',
    '#e879f9', '#64748b'
  ]
};

/* Default opsi Chart.js agar semua chart konsisten */
Chart.defaults.font.family = '-apple-system, "Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#64748b';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.85)';
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;

/* ─────────────────────────────────────────────────────────────
   STATE GLOBAL
───────────────────────────────────────────────────────────── */
let allData      = [];   // Data mentah dari JSON
let filteredData = [];   // Data setelah filter diterapkan

// Referensi instance chart agar bisa di-destroy sebelum re-render
const charts = {};

/* ─────────────────────────────────────────────────────────────
   ENTRY POINT — Muat data JSON lalu inisialisasi dashboard
───────────────────────────────────────────────────────────── */
fetch('sales_data.json')
  .then(res => {
    if (!res.ok) throw new Error('Gagal memuat sales_data.json');
    return res.json();
  })
  .then(data => {
    allData      = data;
    filteredData = [...data];

    populateFilters(data);   // Isi opsi dropdown dari data
    attachFilterListeners(); // Pasang event listener filter
    renderDashboard();       // Render KPI + semua chart
  })
  .catch(err => {
    console.error(err);
    document.querySelector('main').innerHTML =
      `<div class="text-center py-20 text-red-500 font-semibold">
        ⚠️ Gagal memuat data: ${err.message}<br>
        <span class="text-slate-500 text-sm font-normal">
          Pastikan Anda menjalankan halaman ini melalui server lokal (bukan file://).
        </span>
      </div>`;
  });

/* ─────────────────────────────────────────────────────────────
   POPULATE FILTER DROPDOWNS
   Mengisi opsi select secara dinamis berdasarkan nilai unik di data
───────────────────────────────────────────────────────────── */
function populateFilters(data) {
  const regions    = [...new Set(data.map(d => d.Region))].sort();
  const categories = [...new Set(data.map(d => d.Product_Category))].sort();
  const customers  = [...new Set(data.map(d => d.Customer_Type))].sort();
  const channels   = [...new Set(data.map(d => d.Sales_Channel))].sort();

  fillSelect('filterRegion',   regions);
  fillSelect('filterCategory', categories);
  fillSelect('filterCustomer', customers);
  fillSelect('filterChannel',  channels);
}

/** Helper: tambahkan <option> ke elemen <select> berdasarkan array nilai */
function fillSelect(id, values) {
  const el = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

/* ─────────────────────────────────────────────────────────────
   FILTER LISTENERS
   Setiap perubahan filter memperbarui filteredData & re-render
───────────────────────────────────────────────────────────── */
function attachFilterListeners() {
  ['filterRegion', 'filterCategory', 'filterCustomer', 'filterChannel']
    .forEach(id => {
      document.getElementById(id).addEventListener('change', applyFilters);
    });

  // Tombol reset — kembalikan semua filter ke "all"
  document.getElementById('btnReset').addEventListener('click', () => {
    ['filterRegion', 'filterCategory', 'filterCustomer', 'filterChannel']
      .forEach(id => { document.getElementById(id).value = 'all'; });
    applyFilters();
  });
}

/** Terapkan filter berdasarkan nilai dropdown yang aktif */
function applyFilters() {
  const region   = document.getElementById('filterRegion').value;
  const category = document.getElementById('filterCategory').value;
  const customer = document.getElementById('filterCustomer').value;
  const channel  = document.getElementById('filterChannel').value;

  filteredData = allData.filter(d => {
    return (region   === 'all' || d.Region           === region)   &&
           (category === 'all' || d.Product_Category === category) &&
           (customer === 'all' || d.Customer_Type    === customer) &&
           (channel  === 'all' || d.Sales_Channel    === channel);
  });

  renderDashboard();
}

/* ─────────────────────────────────────────────────────────────
   RENDER DASHBOARD — Orkestrasi KPI + semua chart
───────────────────────────────────────────────────────────── */
function renderDashboard() {
  renderKPI();
  renderTrend();
  renderRegion();
  renderCategory();
  renderRep();
  renderCustomer();
  renderPayment();
  renderChannel();
  renderScatter();
  renderTop10();
  renderQtyCategory();
}

/* ─────────────────────────────────────────────────────────────
   HELPERS UMUM
───────────────────────────────────────────────────────────── */

/** Destroy chart sebelumnya agar tidak terjadi memory leak / overlay */
function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

/** Format angka ke Rupiah-gaya dengan pemisah ribuan */
function formatCurrency(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

/** Agregasi data: jumlahkan nilai field berdasarkan key */
function aggregate(data, keyField, valueField) {
  return data.reduce((acc, d) => {
    const k = d[keyField];
    acc[k] = (acc[k] || 0) + d[valueField];
    return acc;
  }, {});
}

/** Hitung jumlah kemunculan setiap nilai field (count) */
function countBy(data, field) {
  return data.reduce((acc, d) => {
    acc[d[field]] = (acc[d[field]] || 0) + 1;
    return acc;
  }, {});
}

/* ─────────────────────────────────────────────────────────────
   1. KPI CARDS
───────────────────────────────────────────────────────────── */
function renderKPI() {
  const n     = filteredData.length;
  const total = allData.length;

  const revenue  = filteredData.reduce((s, d) => s + d.Sales_Amount, 0);
  const qty      = filteredData.reduce((s, d) => s + d.Quantity_Sold, 0);
  const avgDisc  = n > 0
    ? (filteredData.reduce((s, d) => s + d.Discount, 0) / n * 100)
    : 0;

  // Revenue
  document.getElementById('kpiRevenue').textContent      = formatCurrency(revenue);
  document.getElementById('kpiRevenueSub').textContent   = `Dari ${n} transaksi`;

  // Transactions
  document.getElementById('kpiTransactions').textContent    = n.toLocaleString('id-ID');
  document.getElementById('kpiTransactionsSub').textContent = `${((n / total) * 100).toFixed(1)}% dari total data`;

  // Quantity
  document.getElementById('kpiQty').textContent    = qty.toLocaleString('id-ID');
  document.getElementById('kpiQtySub').textContent = `Rata-rata ${(qty / (n || 1)).toFixed(1)} per transaksi`;

  // Avg Discount
  document.getElementById('kpiDiscount').textContent    = avgDisc.toFixed(1) + '%';
  document.getElementById('kpiDiscountSub').textContent = `Rata-rata diskon per transaksi`;
}

/* ─────────────────────────────────────────────────────────────
   2. SALES TREND (Line Chart — bulanan)
───────────────────────────────────────────────────────────── */
function renderTrend() {
  destroyChart('trend');

  // Kelompokkan berdasarkan bulan (YYYY-MM)
  const monthly = filteredData.reduce((acc, d) => {
    const month = d.Sale_Date.slice(0, 7); // "2023-01"
    acc[month] = (acc[month] || 0) + d.Sales_Amount;
    return acc;
  }, {});

  // Urutkan bulan kronologis
  const labels = Object.keys(monthly).sort();
  const values = labels.map(k => monthly[k]);

  // Label lebih ramah: "Jan", "Feb", dst
  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const readableLabels = labels.map(l => {
    const m = parseInt(l.split('-')[1], 10);
    return monthNames[m - 1];
  });

  charts.trend = new Chart(document.getElementById('chartTrend'), {
    type: 'line',
    data: {
      labels: readableLabels,
      datasets: [{
        label: 'Revenue (USD)',
        data: values,
        borderColor: PALETTE.primary,
        backgroundColor: 'rgba(59,130,212,0.1)',
        borderWidth: 2.5,
        pointBackgroundColor: PALETTE.primary,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => formatCurrency(v)
          },
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   3. REVENUE PER REGION (Horizontal Bar)
───────────────────────────────────────────────────────────── */
function renderRegion() {
  destroyChart('region');
  const agg    = aggregate(filteredData, 'Region', 'Sales_Amount');
  const labels = Object.keys(agg).sort((a, b) => agg[b] - agg[a]);
  const values = labels.map(k => agg[k]);

  charts.region = new Chart(document.getElementById('chartRegion'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        backgroundColor: PALETTE.multi.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { callback: v => formatCurrency(v) },
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   4. REVENUE PER PRODUCT CATEGORY (Doughnut)
───────────────────────────────────────────────────────────── */
function renderCategory() {
  destroyChart('category');
  const agg    = aggregate(filteredData, 'Product_Category', 'Sales_Amount');
  const labels = Object.keys(agg);
  const values = labels.map(k => agg[k]);

  charts.category = new Chart(document.getElementById('chartCategory'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: PALETTE.multi.slice(0, labels.length),
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`
          }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   5. SALES PER SALES REP (Vertical Bar)
───────────────────────────────────────────────────────────── */
function renderRep() {
  destroyChart('rep');
  const agg    = aggregate(filteredData, 'Sales_Rep', 'Sales_Amount');
  const labels = Object.keys(agg).sort((a, b) => agg[b] - agg[a]);
  const values = labels.map(k => agg[k]);

  charts.rep = new Chart(document.getElementById('chartRep'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        backgroundColor: PALETTE.multi.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => formatCurrency(v) },
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   6. CUSTOMER TYPE DISTRIBUTION (Pie)
───────────────────────────────────────────────────────────── */
function renderCustomer() {
  destroyChart('customer');
  const cnt    = countBy(filteredData, 'Customer_Type');
  const labels = Object.keys(cnt);
  const values = labels.map(k => cnt[k]);

  charts.customer = new Chart(document.getElementById('chartCustomer'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [PALETTE.primary, PALETTE.accent],
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} transaksi`
          }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   7. PAYMENT METHOD USAGE (Doughnut)
───────────────────────────────────────────────────────────── */
function renderPayment() {
  destroyChart('payment');
  const cnt    = countBy(filteredData, 'Payment_Method');
  const labels = Object.keys(cnt);
  const values = labels.map(k => cnt[k]);

  charts.payment = new Chart(document.getElementById('chartPayment'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [PALETTE.secondary, PALETTE.warn, PALETTE.accent],
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} transaksi`
          }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   8. SALES CHANNEL DISTRIBUTION (Pie)
───────────────────────────────────────────────────────────── */
function renderChannel() {
  destroyChart('channel');
  const cnt    = countBy(filteredData, 'Sales_Channel');
  const labels = Object.keys(cnt);
  const values = labels.map(k => cnt[k]);

  charts.channel = new Chart(document.getElementById('chartChannel'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [PALETTE.danger, PALETTE.warn],
        hoverOffset: 8,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} transaksi`
          }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   9. DISCOUNT vs SALES AMOUNT (Scatter Plot)
───────────────────────────────────────────────────────────── */
function renderScatter() {
  destroyChart('scatter');

  // Ambil semua data poin: { x: Discount (%), y: Sales_Amount }
  const points = filteredData.map(d => ({
    x: parseFloat((d.Discount * 100).toFixed(1)),
    y: parseFloat(d.Sales_Amount.toFixed(2))
  }));

  charts.scatter = new Chart(document.getElementById('chartScatter'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Transaksi',
        data: points,
        backgroundColor: 'rgba(59,130,212,0.5)',
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Diskon: ${ctx.parsed.x}% | Sales: ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Discount (%)', color: '#64748b' },
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        y: {
          title: { display: true, text: 'Sales Amount', color: '#64748b' },
          ticks: { callback: v => formatCurrency(v) },
          grid: { color: 'rgba(100,116,139,0.1)' }
        }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   10. TOP 10 HIGHEST SALES (Horizontal Bar)
───────────────────────────────────────────────────────────── */
function renderTop10() {
  destroyChart('top10');

  // Urutkan descending, ambil 10 teratas
  const top = [...filteredData]
    .sort((a, b) => b.Sales_Amount - a.Sales_Amount)
    .slice(0, 10);

  // Label: "Rep — Produk #ID (Tgl)"
  const labels = top.map(d =>
    `${d.Sales_Rep} | #${d.Product_ID}`
  );
  const values = top.map(d => d.Sales_Amount);

  charts.top10 = new Chart(document.getElementById('chartTop10'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Sales Amount',
        data: values,
        backgroundColor: PALETTE.multi.slice(0, top.length),
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { callback: v => formatCurrency(v) },
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   11. QUANTITY SOLD PER CATEGORY (Vertical Bar)
───────────────────────────────────────────────────────────── */
function renderQtyCategory() {
  destroyChart('qtyCategory');
  const agg    = aggregate(filteredData, 'Product_Category', 'Quantity_Sold');
  const labels = Object.keys(agg).sort((a, b) => agg[b] - agg[a]);
  const values = labels.map(k => agg[k]);

  charts.qtyCategory = new Chart(document.getElementById('chartQtyCategory'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Sold',
        data: values,
        backgroundColor: PALETTE.multi.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(100,116,139,0.1)' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}
