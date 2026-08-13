/**
 * Dashboard Pengawasan LJK — OJK Kalsel 2026
 * Revisi: 2-halaman (Monitoring + Analitik) + sidebar navigasi
 */

// ─── Constants ──────────────────────────────────────────────────────────────
const BULAN_ORDER  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const KUARTAL_ORDER = ['Q1','Q2','Q3','Q4'];
const DASHBOARD_YEAR = 2026;

const COLOR_MAROON = '#A91024';
const COLOR_GREEN  = '#22c55e';
const COLOR_YELLOW = '#f59e0b';
const COLOR_BLUE   = '#3b82f6';
const COLOR_RED    = '#ef4444';
const COLOR_PURPLE = '#8b5cf6';

// ─── State ───────────────────────────────────────────────────────────────────
let DATA = null;
let charts = {};
let isInitialized = false;
let currentPage = 'monitoring';
let analitikInitialized = false;
let autoRefreshTimer = null;

// ═══════════════════════════════════════════════════════════════════
// LOADING & DATA
// ═══════════════════════════════════════════════════════════════════
function showLoading(on) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function showError(msg) {
  const main = document.querySelector('.main-content') || document.body;
  const div = document.createElement('div');
  div.style.cssText = 'text-align:center;padding:1.5rem;background:#fee2e2;color:#991b1b;border-radius:12px;margin:1rem 0;font-weight:600;font-size:13px;';
  div.innerHTML = `⚠️ ${msg}`;
  main.insertAdjacentElement('afterbegin', div);
}

async function loadData(isManual = false) {
  if (!isInitialized) showLoading(true);

  const failsafe = setTimeout(() => {
    showLoading(false);
    console.warn('Failsafe: loading overlay hidden after 15s');
  }, 15000);

  try {
    const res = await fetch('/api/data?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    clearTimeout(failsafe);
    showLoading(false);

    if (!isInitialized) {
      isInitialized = true;
      initDashboard();
      if (!autoRefreshTimer) {
        autoRefreshTimer = setInterval(() => loadData(false), 30000);
      }
    } else {
      // Auto-refresh: preserve filter state, repopulate, update
      const savedState = saveFilterState();
      populateFilters();
      restoreFilterState(savedState);
      updateDashboard();
    }
  } catch (err) {
    clearTimeout(failsafe);
    showLoading(false);
    console.error('Gagal load data:', err);
    if (!isInitialized) {
      showError('Gagal memuat data. Pastikan file data/data.json tersedia.');
    }
  }
}

// ─── Manual Sync (tombol Sync di sidebar) ────────────────────────────────────
async function syncData() {
  const btn = document.getElementById('btnSync');
  const iconEl = document.getElementById('syncBtnIcon');
  const textEl = document.getElementById('syncBtnText');

  if (!btn) return;
  btn.disabled = true;
  btn.classList.add('syncing');
  if (iconEl) iconEl.textContent = '🔄';
  if (textEl) textEl.textContent = 'Syncing...';

  try {
    const res = await fetch('/api/data?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();

    // Save timestamp to localStorage
    const now = new Date();
    localStorage.setItem('dashboardLastSync', now.toISOString());
    updateSyncStatus(now);

    // Preserve filters, refresh dashboard
    const savedState = saveFilterState();
    populateFilters();
    restoreFilterState(savedState);
    updateDashboard();

    // Success feedback
    btn.classList.remove('syncing');
    btn.classList.add('success');
    if (iconEl) iconEl.textContent = '✅';
    if (textEl) textEl.textContent = 'Berhasil!';
    setTimeout(() => {
      btn.classList.remove('success');
      if (iconEl) iconEl.textContent = '🔄';
      if (textEl) textEl.textContent = 'Sync';
      btn.disabled = false;
    }, 2200);

  } catch (err) {
    console.error('Sync gagal:', err);
    btn.classList.remove('syncing');
    btn.classList.add('error');
    if (iconEl) iconEl.textContent = '❌';
    if (textEl) textEl.textContent = 'Gagal';
    setTimeout(() => {
      btn.classList.remove('error');
      if (iconEl) iconEl.textContent = '🔄';
      if (textEl) textEl.textContent = 'Sync';
      btn.disabled = false;
    }, 2200);
  }
}

// ─── Sync Status Display ──────────────────────────────────────────────────────
function updateSyncStatus(date) {
  const el = document.getElementById('syncStatus');
  if (!el || !date) return;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateStr = d.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Asia/Makassar' // WITA
    });
    const timeStr = d.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Makassar'
    });
    el.textContent = `Terakhir Sync: ${dateStr}, ${timeStr} WITA`;
  } catch (e) {
    el.textContent = 'Terakhir Sync: —';
  }
}

function loadSyncStatusFromStorage() {
  const stored = localStorage.getItem('dashboardLastSync');
  if (stored) {
    updateSyncStatus(new Date(stored));
  }
}

// ═══════════════════════════════════════════════════════════════════
// PAGE ROUTING
// ═══════════════════════════════════════════════════════════════════
function showPage(page) {
  currentPage = page;

  const monEl = document.getElementById('page-monitoring');
  const anaEl = document.getElementById('page-analitik');
  const kelEl = document.getElementById('page-kelola');
  if (monEl) monEl.style.display = page === 'monitoring' ? 'flex' : 'none';
  if (anaEl) anaEl.style.display = page === 'analitik'   ? 'flex' : 'none';
  if (kelEl) kelEl.style.display = page === 'kelola'     ? 'flex' : 'none';

  document.getElementById('navMonitoring')?.classList.toggle('active', page === 'monitoring');
  document.getElementById('navAnalitik')?.classList.toggle('active',   page === 'analitik');
  document.getElementById('navKelola')?.classList.toggle('active',     page === 'kelola');

  if (!DATA) return;

  if (page === 'monitoring') {
    updateMonitoring();
  } else if (page === 'analitik') {
    analitikInitialized = true;
    updateAnalitik();
  } else if (page === 'kelola') {
    updateKelolaData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
function initDashboard() {
  if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
  
  // ── Global Chart UX Improvements ──
  Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#6b7280';
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 750;
  Chart.defaults.animation.easing = 'easeOutQuart';
  
  // Premium Tooltips
  if (Chart.defaults.plugins.tooltip) {
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#111827';
    Chart.defaults.plugins.tooltip.bodyColor = '#374151';
    Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: 'bold', family: "'Inter', sans-serif" };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 12, family: "'Inter', sans-serif" };
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,0,0,0.08)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.boxPadding = 6;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
  }

  // Cleaner Data Labels
  if (Chart.defaults.plugins.datalabels) {
    Chart.defaults.plugins.datalabels.color = '#fff';
    Chart.defaults.plugins.datalabels.font = { size: 10, weight: 'bold' };
    Chart.defaults.plugins.datalabels.display = (context) => context.dataset.data[context.dataIndex] > 0;
  }

  loadSyncStatusFromStorage();
  populateFilters();
  setupFilterListeners();
  updateMonitoring(); // Render monitoring page on load
  // Analitik is deferred until user visits it (to avoid chart sizing issues on hidden elements)
}

// ═══════════════════════════════════════════════════════════════════
// FILTER POPULATION
// ═══════════════════════════════════════════════════════════════════
function populateFilters() {
  const addOpts = (id, vals) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  };

  const getUniq = field => [...new Set(DATA.kegiatan.map(k => k[field]).filter(Boolean))].sort();
  const activeBulan = BULAN_ORDER.filter(b => DATA.kegiatan.some(k => k.bulan === b));

  // Collect all unique anggota dynamically
  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) k.anggota.forEach(a => anggotaSet.add(a));
  });
  const allAnggota = [...anggotaSet].sort();

  // ── Monitoring filters
  addOpts('m-filterBulan',       activeBulan);
  addOpts('m-filterSupervisor',  getUniq('supervisor'));
  addOpts('m-filterPegawai',     allAnggota);

  // ── Analitik filters
  addOpts('a-filterBulan',         activeBulan);
  addOpts('a-filterStatus',        getUniq('statusKegiatan'));
  addOpts('a-filterJenisKegiatan', getUniq('jenisKegiatan'));
  addOpts('a-filterKotaKab',       getUniq('kotaKab'));
  addOpts('a-filterSupervisor',    getUniq('supervisor'));
  addOpts('a-filterPegawai',       allAnggota);
  addOpts('a-filterBidang',        getUniq('bidang'));
  addOpts('a-filterJenisLJK',      getUniq('jenisLJK'));

  // ── Kelola filters
  addOpts('k-filterBulan',         activeBulan);
  addOpts('k-filterKuartal',       KUARTAL_ORDER);
  addOpts('k-filterBidang',        getUniq('bidang'));
  addOpts('k-filterJenisLJK',      getUniq('jenisLJK'));
  addOpts('k-filterSupervisor',    getUniq('supervisor'));
  addOpts('k-filterStatus',        getUniq('statusKegiatan'));
  addOpts('k-filterKotaKab',       getUniq('kotaKab'));
}

function setupFilterListeners() {
  ['m-filterBulan', 'm-filterSupervisor', 'm-filterPegawai'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateMonitoring);
  });
  ['a-filterBulan', 'a-filterStatus', 'a-filterJenisKegiatan', 'a-filterKotaKab',
   'a-filterSupervisor', 'a-filterPegawai', 'a-filterBidang', 'a-filterJenisLJK'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateAnalitik);
  });
  
  ['k-filterBulan', 'k-filterKuartal', 'k-filterBidang', 'k-filterJenisLJK', 
   'k-filterSupervisor', 'k-filterStatus', 'k-filterKotaKab'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateKelolaData);
  });
  
  const searchInput = document.getElementById('k-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateKelolaData, 300);
    });
  }
}

// ─── Read filter values ──────────────────────────────────────────────────────
function getFilteredData(page) {
  if (!DATA) return [];

  if (page === 'monitoring') {
    const fBulan      = document.getElementById('m-filterBulan')?.value     || '';
    const fSupervisor = document.getElementById('m-filterSupervisor')?.value || '';
    const fPegawai    = document.getElementById('m-filterPegawai')?.value    || '';

    return DATA.kegiatan.filter(k => {
      if (fBulan      && k.bulan      !== fBulan)                                    return false;
      if (fSupervisor && k.supervisor !== fSupervisor)                               return false;
      if (fPegawai    && (!k.anggota  || !k.anggota.includes(fPegawai)))             return false;
      return true;
    });
  } else {
    const fBulan     = document.getElementById('a-filterBulan')?.value         || '';
    const fStatus    = document.getElementById('a-filterStatus')?.value        || '';
    const fJenisKeg  = document.getElementById('a-filterJenisKegiatan')?.value || '';
    const fKota      = document.getElementById('a-filterKotaKab')?.value       || '';
    const fSuper     = document.getElementById('a-filterSupervisor')?.value    || '';
    const fPegawai   = document.getElementById('a-filterPegawai')?.value       || '';
    const fBidang    = document.getElementById('a-filterBidang')?.value        || '';
    const fJenisLJK  = document.getElementById('a-filterJenisLJK')?.value      || '';

    return DATA.kegiatan.filter(k => {
      if (fBulan    && k.bulan          !== fBulan)                              return false;
      if (fStatus   && k.statusKegiatan !== fStatus)                             return false;
      if (fJenisKeg && k.jenisKegiatan  !== fJenisKeg)                           return false;
      if (fKota     && k.kotaKab        !== fKota)                               return false;
      if (fSuper    && k.supervisor     !== fSuper)                               return false;
      if (fPegawai  && (!k.anggota     || !k.anggota.includes(fPegawai)))        return false;
      if (fBidang   && k.bidang         !== fBidang)                             return false;
      if (fJenisLJK && k.jenisLJK       !== fJenisLJK)                           return false;
      return true;
    });
  }
}

// ─── Save / Restore Filter State (for auto-refresh) ──────────────────────────
function saveFilterState() {
  const ids = [
    'm-filterBulan','m-filterSupervisor','m-filterPegawai',
    'a-filterBulan','a-filterStatus','a-filterJenisKegiatan','a-filterKotaKab',
    'a-filterSupervisor','a-filterPegawai','a-filterBidang','a-filterJenisLJK',
    'k-filterBulan','k-filterKuartal','k-filterBidang','k-filterJenisLJK',
    'k-filterSupervisor','k-filterStatus','k-filterKotaKab','k-search'
  ];
  const state = {};
  ids.forEach(id => { const el = document.getElementById(id); if (el) state[id] = el.value; });
  return state;
}

function restoreFilterState(state) {
  Object.keys(state).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      if ([...el.options].some(o => o.value === state[id])) el.value = state[id];
    } else {
      el.value = state[id];
    }
  });
}

// ─── Reset Filters ────────────────────────────────────────────────────────────
function resetFilters(page) {
  if (page === 'monitoring') {
    ['m-filterBulan','m-filterSupervisor','m-filterPegawai'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    updateMonitoring();
  } else if (page === 'analitik') {
    ['a-filterBulan','a-filterStatus','a-filterJenisKegiatan','a-filterKotaKab',
     'a-filterSupervisor','a-filterPegawai','a-filterBidang','a-filterJenisLJK'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    updateAnalitik();
  } else if (page === 'kelola') {
    ['k-filterBulan','k-filterKuartal','k-filterBidang','k-filterJenisLJK',
     'k-filterSupervisor','k-filterStatus','k-filterKotaKab'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const searchEl = document.getElementById('k-search');
    if (searchEl) searchEl.value = '';
    updateKelolaData();
  }
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD UPDATE (called by auto-refresh & sync)
// ═══════════════════════════════════════════════════════════════════
function updateDashboard() {
  updateMonitoring();
  if (analitikInitialized) updateAnalitik();
  if (currentPage === 'kelola') updateKelolaData();
}

// ─── Halaman 1: Monitoring ────────────────────────────────────────────────────
function updateMonitoring() {
  if (!DATA) return;
  const filtered = getFilteredData('monitoring');
  const today = new Date(); today.setHours(0,0,0,0);

  const total    = filtered.length;
  const selesai  = filtered.filter(k => k.statusKegiatan === 'Selesai').length;
  const progress = filtered.filter(k => k.statusKegiatan === 'On Progress').length;
  const belum    = filtered.filter(k => k.statusKegiatan === 'Belum Mulai').length;
  const overdue  = filtered.filter(k =>
    k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length;
  const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

  setText('m-valTotal',    total);
  setText('m-valSelesai',  selesai);
  setText('m-valProgress', progress);
  setText('m-valBelum',    belum);
  setText('m-valOverdue',  overdue);
  setText('m-valCompletion', pct + '%');

  renderCompletionDonut('m-chartCompletion', pct);
  renderTableOverdue(filtered, today);
  renderTableBelumMulai(filtered, today);

  const bulanFilter = document.getElementById('m-filterBulan')?.value || '';
  renderGanttDaily('ganttMonitoring', filtered, bulanFilter);
}

// ─── Halaman 2: Analitik ─────────────────────────────────────────────────────
function updateAnalitik() {
  if (!DATA) return;
  const filtered = getFilteredData('analitik');
  const today = new Date(); today.setHours(0,0,0,0);

  const total    = filtered.length;
  const selesai  = filtered.filter(k => k.statusKegiatan === 'Selesai').length;
  const progress = filtered.filter(k => k.statusKegiatan === 'On Progress').length;
  const belum    = filtered.filter(k => k.statusKegiatan === 'Belum Mulai').length;
  const overdue  = filtered.filter(k =>
    k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length;
  const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;

  setText('a-valTotal',    total);
  setText('a-valSelesai',  selesai);
  setText('a-valProgress', progress);
  setText('a-valBelum',    belum);
  setText('a-valOverdue',  overdue);
  setText('a-valCompletion', pct + '%');

  const statusNote = document.getElementById('statusNote');
  if (statusNote) statusNote.textContent = `Terdapat ${overdue} kegiatan overdue (melewati tanggal selesai namun belum selesai)`;

  renderCompletionDonut('a-chartCompletion', pct);

  const bulanFilter = document.getElementById('a-filterBulan')?.value || '';
  renderGanttDaily('ganttAnalitik', filtered, bulanFilter);

  renderSupervisor(filtered, today);
  renderAnggota(filtered, today);
  renderTrend(filtered);
  renderStatus(filtered);
  renderProgressKuartal(filtered);
  renderHorizontalBar('chartJenisKegiatan', filtered, 'jenisKegiatan');
  renderHorizontalBar('chartBidang',        filtered, 'bidang');
  renderHorizontalBar('chartJenisLJK',      filtered, 'jenisLJK');
  renderKota(filtered);
  renderTop10(filtered);
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); charts[id] = null; }
}

// ═══════════════════════════════════════════════════════════════════
// TABLE: KEGIATAN OVERDUE (Halaman 1)
// ═══════════════════════════════════════════════════════════════════
function renderTableOverdue(data, today) {
  const PREVIEW = 5;
  const overdue = data
    .filter(k => k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today)
    .sort((a, b) => new Date(a.tanggalSelesai) - new Date(b.tanggalSelesai)); // most overdue first

  setText('m-overdueCount', overdue.length);

  const rows = overdue.map((k, i) => {
    const deadline   = new Date(k.tanggalSelesai);
    const daysLate   = Math.floor((today - deadline) / 864e5);
    const pegawai    = k.anggota && k.anggota.length > 0 ? k.anggota.join(', ') : '—';
    const deadlineStr = deadline.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    const isExtra    = i >= PREVIEW;
    return `<tr${isExtra ? ' class="extra-row" style="display:none"' : ''}>
      <td>${i + 1}</td>
      <td title="${escHtml(k.namaKegiatan)}">${truncate(k.namaKegiatan, 45)}</td>
      <td>${escHtml(pegawai)}</td>
      <td>${escHtml(k.supervisor || '—')}</td>
      <td>${deadlineStr}</td>
      <td style="color:#ef4444;font-weight:700;">-${daysLate} hari</td>
      <td><span class="status-badge badge-overdue">Overdue</span></td>
    </tr>`;
  });

  const tbody = document.getElementById('tbodyOverdue');
  if (tbody) tbody.innerHTML = rows.join('') || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#999;">Tidak ada kegiatan overdue 🎉</td></tr>`;

  const showMore = document.getElementById('showMoreOverdue');
  if (showMore) {
    if (overdue.length > PREVIEW) {
      showMore.style.display = 'block';
      showMore.innerHTML = `<button class="show-more-btn" onclick="toggleExtraRows('tbodyOverdue','showMoreOverdue',${overdue.length},${PREVIEW})">Lihat semua overdue (${overdue.length}) →</button>`;
    } else {
      showMore.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TABLE: KEGIATAN BELUM MULAI (Halaman 1)
// ═══════════════════════════════════════════════════════════════════
function renderTableBelumMulai(data, today) {
  const PREVIEW = 5;
  const belum = data
    .filter(k => k.statusKegiatan === 'Belum Mulai' && (!k.tanggalSelesai || new Date(k.tanggalSelesai) >= today))
    .sort((a, b) => {
      const da = a.tanggalSelesai ? new Date(a.tanggalSelesai) : new Date('9999-12-31');
      const db = b.tanggalSelesai ? new Date(b.tanggalSelesai) : new Date('9999-12-31');
      return da - db;
    });

  setText('m-belumCount', belum.length);

  const rows = belum.map((k, i) => {
    const pegawai = k.anggota && k.anggota.length > 0 ? k.anggota.join(', ') : '—';
    let deadlineStr = '—';
    let sisaStr     = '—';
    let sisaStyle   = '';
    if (k.tanggalSelesai) {
      const deadline = new Date(k.tanggalSelesai);
      deadlineStr = deadline.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
      const sisaDays = Math.floor((deadline - today) / 864e5);
      if (sisaDays <= 7) {
        sisaStr = `${sisaDays} hari`;
        sisaStyle = 'color:#f59e0b;font-weight:700;';
      } else {
        sisaStr = `${sisaDays} hari`;
        sisaStyle = 'color:#22c55e;font-weight:600;';
      }
    }
    const isExtra = i >= PREVIEW;
    return `<tr${isExtra ? ' class="extra-row" style="display:none"' : ''}>
      <td>${i + 1}</td>
      <td title="${escHtml(k.namaKegiatan)}">${truncate(k.namaKegiatan, 45)}</td>
      <td>${escHtml(pegawai)}</td>
      <td>${escHtml(k.supervisor || '—')}</td>
      <td>${deadlineStr}</td>
      <td style="${sisaStyle}">${sisaStr}</td>
      <td><span class="status-badge badge-belum">Belum Mulai</span></td>
    </tr>`;
  });

  const tbody = document.getElementById('tbodyBelumMulai');
  if (tbody) tbody.innerHTML = rows.join('') || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#999;">Tidak ada kegiatan belum mulai</td></tr>`;

  const showMore = document.getElementById('showMoreBelum');
  if (showMore) {
    if (belum.length > PREVIEW) {
      showMore.style.display = 'block';
      showMore.innerHTML = `<button class="show-more-btn" onclick="toggleExtraRows('tbodyBelumMulai','showMoreBelum',${belum.length},${PREVIEW})">Lihat semua belum mulai (${belum.length}) →</button>`;
    } else {
      showMore.style.display = 'none';
    }
  }
}

function toggleExtraRows(tbodyId, containerId, total, preview) {
  const tbody = document.getElementById(tbodyId);
  const container = document.getElementById(containerId);
  if (!tbody || !container) return;
  const extras = tbody.querySelectorAll('tr.extra-row');
  const isHidden = extras[0]?.style.display === 'none';
  extras.forEach(r => { r.style.display = isHidden ? '' : 'none'; });
  const btn = container.querySelector('button');
  if (btn) btn.textContent = isHidden
    ? '↑ Tampilkan lebih sedikit'
    : `Lihat semua (${total}) →`;
}

// ─── String helpers ───────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, n) {
  return str && str.length > n ? str.substring(0, n - 1) + '…' : (str || '');
}

// ═══════════════════════════════════════════════════════════════════
// GANTT DAILY
// ═══════════════════════════════════════════════════════════════════
function renderGanttDaily(containerId, data, bulanFilter) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Determine which month to display
  const today = new Date(); today.setHours(0,0,0,0);
  let monthIndex = today.getMonth(); // default = current month
  if (bulanFilter && BULAN_ORDER.includes(bulanFilter)) {
    monthIndex = BULAN_ORDER.indexOf(bulanFilter);
  }

  const YEAR = DASHBOARD_YEAR;
  const daysInMonth = new Date(YEAR, monthIndex + 1, 0).getDate();
  const monthName   = BULAN_ORDER[monthIndex];
  const mStart = new Date(YEAR, monthIndex, 1);
  const mEnd   = new Date(YEAR, monthIndex, daysInMonth);

  const todayD = today.getDate();
  const todayM = today.getMonth();
  const todayY = today.getFullYear();

  // Get status color info
  const getStatusColor = (k) => {
    const isOD = k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today;
    if (isOD)                            return { bg: 'rgba(239,68,68,0.22)',   border: COLOR_RED    };
    if (k.statusKegiatan === 'Selesai')  return { bg: 'rgba(34,197,94,0.22)',   border: COLOR_GREEN  };
    if (k.statusKegiatan === 'On Progress') return { bg: 'rgba(245,158,11,0.22)', border: COLOR_YELLOW };
    return                                        { bg: 'rgba(59,130,246,0.22)', border: COLOR_BLUE  };
  };

  // Filter activities that overlap with selected month
  const monthData = data
    .filter(k => {
      if (!k.tanggalMulai) return false;
      const s = new Date(k.tanggalMulai);
      const e = k.tanggalSelesai ? new Date(k.tanggalSelesai) : s;
      return s <= mEnd && e >= mStart;
    })
    .sort((a, b) => new Date(a.tanggalMulai) - new Date(b.tanggalMulai));

  // Build column headers
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const isT = d === todayD && monthIndex === todayM && YEAR === todayY;
    return `<th class="gantt-day-th${isT ? ' today-col' : ''}">${d}</th>`;
  }).join('');

  // Build rows
  let rowsHtml = '';
  if (monthData.length === 0) {
    rowsHtml = `<tr><td colspan="${daysInMonth + 2}" class="gantt-empty">Tidak ada kegiatan pada ${monthName} ${YEAR}</td></tr>`;
  } else {
    rowsHtml = monthData.map(k => {
      const start = new Date(k.tanggalMulai);
      const end   = k.tanggalSelesai ? new Date(k.tanggalSelesai) : start;
      const sc    = getStatusColor(k);

      // Effective start/end day within this month
      const effStart = start < mStart ? 1                : start.getDate();
      const effEnd   = end   > mEnd   ? daysInMonth      : end.getDate();

      let dayCells = '';
      for (let d = 1; d <= daysInMonth; d++) {
        const inRange = d >= effStart && d <= effEnd;
        const isT = d === todayD && monthIndex === todayM && YEAR === todayY;
        const tClass = isT ? ' today-col' : '';
        if (inRange) {
          const isFirst = d === effStart;
          const isLast  = d === effEnd;
          const br = [
            isFirst ? '4px' : '0',
            isLast  ? '4px' : '0',
            isLast  ? '4px' : '0',
            isFirst ? '4px' : '0'
          ].join(' ');
          dayCells += `<td class="gantt-day-cell active${tClass}" style="background:${sc.bg};border-radius:${br};outline:1px solid ${sc.border}22;"></td>`;
        } else {
          dayCells += `<td class="gantt-day-cell${tClass}"></td>`;
        }
      }

      const pegawai = k.anggota && k.anggota.length > 0 ? k.anggota.join(', ') : '—';
      const tooltip = `${k.namaKegiatan}\nSupervisor: ${k.supervisor || '—'}\nPegawai: ${pegawai}\nStatus: ${k.statusKegiatan}`;

      return `<tr>
        <td class="gantt-name-cell" title="${escHtml(tooltip)}">${truncate(k.namaKegiatan, 38)}</td>
        <td class="gantt-sup-cell">${escHtml(k.supervisor || '—')}</td>
        ${dayCells}
      </tr>`;
    }).join('');
  }

  container.innerHTML = `
    <div class="gantt-toolbar">
      <span style="font-size:11px;font-weight:700;color:var(--text-main);margin-right:auto;">${monthName} ${YEAR} &nbsp;·&nbsp; ${monthData.length} kegiatan</span>
      <div class="gantt-legend">
        <span class="legend-item"><span class="box" style="background:${COLOR_GREEN}"></span> Selesai</span>
        <span class="legend-item"><span class="box" style="background:${COLOR_YELLOW}"></span> On Progress</span>
        <span class="legend-item"><span class="box" style="background:${COLOR_BLUE}"></span> Belum Mulai</span>
        <span class="legend-item"><span class="box" style="background:${COLOR_RED}"></span> Overdue</span>
        ${todayM === monthIndex && todayY === YEAR ? '<span class="legend-item today-marker">▼ Hari Ini</span>' : ''}
      </div>
    </div>
    <div class="gantt-scroll-wrapper">
      <table class="data-table gantt-daily-table">
        <thead>
          <tr>
            <th class="gantt-name-th">Nama Kegiatan</th>
            <th class="gantt-sup-th">Supervisor</th>
            ${dayHeaders}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════════════════

// ── Completion Donut ─────────────────────────────────────────────────────────
function renderCompletionDonut(id, pct) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return;
  charts[id] = new Chart(canvas, {
    type: 'doughnut',
    data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: [COLOR_MAROON, '#e5e7eb'], borderWidth: 0 }] },
    options: { cutout: '75%', plugins: { tooltip: { enabled: false }, datalabels: { display: false } }, animation: { duration: 600 } }
  });
}

// ── Trend per Bulan ───────────────────────────────────────────────────────────
function renderTrend(data) {
  destroyChart('chartTrend');
  const counts = BULAN_ORDER.map(b => data.filter(k => k.bulan === b).length);
  charts['chartTrend'] = new Chart(document.getElementById('chartTrend'), {
    type: 'bar',
    data: { labels: BULAN_SHORT, datasets: [{ data: counts, backgroundColor: COLOR_MAROON, barPercentage: 0.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'top', color: '#1d1d1f', formatter: v => v > 0 ? v : '' }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...counts, 1) + 5 },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Status Kegiatan (donut) ───────────────────────────────────────────────────
function renderStatus(data) {
  destroyChart('chartStatus');
  const selesai  = data.filter(k => k.statusKegiatan === 'Selesai').length;
  const progress = data.filter(k => k.statusKegiatan === 'On Progress').length;
  const belum    = data.filter(k => k.statusKegiatan === 'Belum Mulai').length;
  const total    = selesai + progress + belum;

  charts['chartStatus'] = new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
      labels: ['Selesai', 'On Progress', 'Belum Mulai'],
      datasets: [{ data: [selesai, progress, belum], backgroundColor: [COLOR_GREEN, COLOR_YELLOW, COLOR_BLUE], borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '40%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12, font: { size: 10 },
            generateLabels: chart => chart.data.labels.map((l, i) => ({
              text: `${l}\n${chart.data.datasets[0].data[i]} Kegiatan`,
              fillStyle: chart.data.datasets[0].backgroundColor[i],
              strokeStyle: chart.data.datasets[0].backgroundColor[i]
            }))
          }
        },
        datalabels: {
          formatter: (val) => total > 0 && val > 0 ? Math.round((val / total) * 100) + '%' : '',
          color: '#fff', font: { weight: 'bold', size: 10 }
        }
      }
    }
  });
}

// ── Progress per Kuartal ─────────────────────────────────────────────────────
function renderProgressKuartal(data) {
  destroyChart('chartKuartal');
  const counts   = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q).length);
  const selesais = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q && k.statusKegiatan === 'Selesai').length);
  const pcts     = counts.map((c, i) => c > 0 ? Math.round((selesais[i] / c) * 100) : 0);
  const labels   = ['Q1\n(Jan-Mar)', 'Q2\n(Apr-Jun)', 'Q3\n(Jul-Sep)', 'Q4\n(Okt-Des)'];

  charts['chartKuartal'] = new Chart(document.getElementById('chartKuartal'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'Persentase Selesai', data: pcts, borderColor: COLOR_YELLOW, backgroundColor: COLOR_YELLOW, yAxisID: 'y1', datalabels: { align: 'top', anchor: 'end', formatter: v => v + '%', color: '#1d1d1f' } },
        { type: 'bar',  label: 'Total Kegiatan',     data: counts, backgroundColor: COLOR_MAROON, barPercentage: 0.4, yAxisID: 'y', datalabels: { align: 'top', anchor: 'end', color: '#1d1d1f', formatter: v => v > 0 ? v : '' } }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
      scales: {
        y:  { type: 'linear', position: 'left',  beginAtZero: true, suggestedMax: Math.max(...counts, 1) + 5 },
        y1: { type: 'linear', position: 'right', min: 0, max: 120, grid: { display: false }, ticks: { callback: v => v + '%' } },
        x:  { grid: { display: false } }
      }
    }
  });
}

// ── Status per Supervisor (stacked bar) ───────────────────────────────────────
function renderSupervisor(data, today) {
  destroyChart('chartSupervisor');
  if (!today) { today = new Date(); today.setHours(0,0,0,0); }
  const sups = [...new Set(DATA.kegiatan.map(k => k.supervisor || 'Lainnya').filter(Boolean))].sort();
  const ds = status => sups.map(s => data.filter(k => (k.supervisor || 'Lainnya') === s && k.statusKegiatan === status).length);
  const dOverdue = sups.map(s => data.filter(k =>
    (k.supervisor || 'Lainnya') === s && k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length);

  charts['chartSupervisor'] = new Chart(document.getElementById('chartSupervisor'), {
    type: 'bar',
    data: {
      labels: sups,
      datasets: [
        { label: 'Selesai',     data: ds('Selesai'),     backgroundColor: COLOR_GREEN  },
        { label: 'On Progress', data: ds('On Progress'), backgroundColor: COLOR_YELLOW },
        { label: 'Belum Mulai', data: ds('Belum Mulai'), backgroundColor: COLOR_BLUE  },
        { label: 'Overdue',     data: dOverdue,           backgroundColor: COLOR_RED   },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, font: { size: 9 } } },
        datalabels: { formatter: v => v > 0 ? v : '' }
      },
      scales: { x: { stacked: true }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } }
    }
  });
}

// ── Grafik Status per Pegawai (stacked bar) ───────────────────────────────────
function renderAnggota(data, today) {
  destroyChart('chartAnggota');
  if (!today) { today = new Date(); today.setHours(0,0,0,0); }

  // Use full DATA to get all unique anggota names
  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) k.anggota.forEach(a => anggotaSet.add(a));
  });
  const angs = [...anggotaSet].sort();

  if (angs.length === 0) {
    const el = document.getElementById('chartAnggota');
    if (el) el.parentElement.innerHTML = '<div style="text-align:center;margin-top:20px;color:#999;font-size:12px;">Tidak ada data pegawai</div>';
    return;
  }

  const ds = status => angs.map(a =>
    data.filter(k => k.anggota && k.anggota.includes(a) && k.statusKegiatan === status).length
  );
  const dOverdue = angs.map(a => data.filter(k =>
    k.anggota && k.anggota.includes(a) && k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length);

  charts['chartAnggota'] = new Chart(document.getElementById('chartAnggota'), {
    type: 'bar',
    data: {
      labels: angs,
      datasets: [
        { label: 'Selesai',     data: ds('Selesai'),     backgroundColor: COLOR_GREEN  },
        { label: 'On Progress', data: ds('On Progress'), backgroundColor: COLOR_YELLOW },
        { label: 'Belum Mulai', data: ds('Belum Mulai'), backgroundColor: COLOR_BLUE  },
        { label: 'Overdue',     data: dOverdue,           backgroundColor: COLOR_RED   },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, font: { size: 9 } } },
        datalabels: { formatter: v => v > 0 ? v : '' }
      },
      scales: { x: { stacked: true }, y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } }
    }
  });
}

// ── Generic Horizontal Bar ────────────────────────────────────────────────────
function renderHorizontalBar(id, data, field) {
  destroyChart(id);
  const counts = {};
  data.forEach(k => { const v = k[field] || 'Lainnya'; counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const vals   = sorted.map(i => i[1]);

  charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: COLOR_MAROON, barPercentage: 0.6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'right', color: '#1d1d1f' }
      },
      scales: {
        x: { beginAtZero: true, suggestedMax: Math.max(...vals, 1) * 1.2, grid: { drawBorder: false } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── Kegiatan per Kab/Kota ────────────────────────────────────────────────────
function renderKota(data) {
  destroyChart('chartKota');
  const counts = {};
  data.forEach(k => {
    let v = k.kotaKab || 'Lainnya';
    v = v.replace(/^(Kab\.|Kota)\s+/i, '');
    counts[v] = (counts[v] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const vals   = sorted.map(i => i[1]);

  charts['chartKota'] = new Chart(document.getElementById('chartKota'), {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: COLOR_MAROON, barPercentage: 0.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'top', color: '#1d1d1f' }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...vals, 1) * 1.2 },
        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

// ── Top 10 PUJK ──────────────────────────────────────────────────────────────
function renderTop10(data) {
  const pujkCount = {};
  data.forEach(k => {
    if (k.namaPUJK) {
      if (!pujkCount[k.namaPUJK]) pujkCount[k.namaPUJK] = { c: 0, b: k.bidang, l: k.jenisLJK };
      pujkCount[k.namaPUJK].c++;
    }
  });
  const sorted = Object.entries(pujkCount).sort((a, b) => b[1].c - a[1].c).slice(0, 10);
  const tbody = document.getElementById('tbodyTop10');
  if (tbody) {
    tbody.innerHTML = sorted.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(item[0])}</td>
        <td>${escHtml(item[1].l)}</td>
        <td>${escHtml(item[1].b)}</td>
        <td style="text-align:center">${item[1].c}</td>
      </tr>`).join('');
  }
}

// ═════════════════════════════════════════════════════════════════
// FORM MODAL: TAMBAH KEGIATAN
// ═════════════════════════════════════════════════════════════════

function openFormModal() {
  const modal = document.getElementById('formModal');
  if (modal) {
    modal.style.display = 'flex';
    populateFormDataLists();
    // Restore Nama Penginput from localStorage if available
    const savedName = localStorage.getItem('dashboardPenginput');
    if (savedName) {
      const el = document.getElementById('f-namaPenginput');
      if (el && !el.value) el.value = savedName;
    }
  }
}

function closeFormModal() {
  const modal = document.getElementById('formModal');
  if (modal) modal.style.display = 'none';
}

// Populate datalists for autocomplete from existing data
function populateFormDataLists() {
  if (!DATA) return;

  const fillDatalist = (id, values) => {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = '';
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      dl.appendChild(opt);
    });
  };

  const getUniq = field => [...new Set(DATA.kegiatan.map(k => k[field]).filter(Boolean))].sort();

  fillDatalist('dl-pujk', getUniq('namaPUJK'));
  fillDatalist('dl-kota', getUniq('kotaKab'));

  // Anggota from all unique names
  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) k.anggota.forEach(a => anggotaSet.add(a));
  });
  fillDatalist('dl-anggota', [...anggotaSet].sort());
}

async function submitKegiatan(event) {
  event.preventDefault();

  const btn = document.getElementById('btnSubmitKegiatan');
  const btnText = document.getElementById('submitBtnText');
  if (!btn) return;

  btn.disabled = true;
  const origText = btnText.textContent;
  btnText.textContent = '⏳ Menyimpan...';

  const payload = {
    namaKegiatan:   document.getElementById('f-namaKegiatan')?.value || '',
    namaPUJK:       document.getElementById('f-namaPUJK')?.value || '',
    kotaKab:        document.getElementById('f-kotaKab')?.value || '',
    bidang:         document.getElementById('f-bidang')?.value || '',
    jenisLJK:       document.getElementById('f-jenisLJK')?.value || '',
    jenisKegiatan:  document.getElementById('f-jenisKegiatan')?.value || '',
    tanggalMulai:   document.getElementById('f-tanggalMulai')?.value || '',
    tanggalSelesai: document.getElementById('f-tanggalSelesai')?.value || '',
    supervisor:     document.getElementById('f-supervisor')?.value || '',
    statusKegiatan: document.getElementById('f-statusKegiatan')?.value || 'Belum Mulai',
    anggota1:       document.getElementById('f-anggota1')?.value || '',
    anggota2:       document.getElementById('f-anggota2')?.value || '',
    anggota3:       document.getElementById('f-anggota3')?.value || '',
    anggota4:       document.getElementById('f-anggota4')?.value || '',
    namaPenginput:  document.getElementById('f-namaPenginput')?.value || '',
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan data');
    }

    // Save Nama Penginput for next time
    if (payload.namaPenginput) {
      localStorage.setItem('dashboardPenginput', payload.namaPenginput);
    }

    showToast(`✅ ${data.message}`, 'success');
    closeFormModal();
    document.getElementById('formKegiatan')?.reset();

    // Restore saved penginput name after reset
    const savedName = localStorage.getItem('dashboardPenginput');
    if (savedName) {
      const el = document.getElementById('f-namaPenginput');
      if (el) el.value = savedName;
    }

    // Refresh dashboard data
    await loadData(true);

  } catch (err) {
    console.error('Submit error:', err);
    showToast(`❌ ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = origText;
  }
}

// ─── Toast Notification System ─────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => loadData(false));

// ═════════════════════════════════════════════════════════════════
// EXPORT & DOWNLOAD
// ═════════════════════════════════════════════════════════════════
async function downloadPageImage(pageName) {
  const el = document.getElementById(`page-${pageName}`);
  if (!el || typeof html2canvas === 'undefined') {
    showToast('❌ html2canvas belum dimuat', 'error');
    return;
  }
  showToast('⏳ Menyiapkan gambar...', 'info');
  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
    const link = document.createElement('a');
    link.download = `dashboard-${pageName}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ Gambar berhasil diunduh', 'success');
  } catch (e) {
    console.error(e);
    showToast('❌ Gagal membuat gambar', 'error');
  }
}

// ═════════════════════════════════════════════════════════════════
// KELOLA DATA LOGIC
// ═════════════════════════════════════════════════════════════════
let kelolaSortOrder = 1; // 1 = asc, -1 = desc

function toggleKelolaSort() {
  kelolaSortOrder *= -1;
  const th = document.getElementById('k-thTanggal');
  if (th) th.innerHTML = `Tanggal ${kelolaSortOrder === 1 ? '↑' : '↓'}`;
  updateKelolaData();
}

function updateKelolaData() {
  if (!DATA) return;
  
  // 1. Get filter values
  const search     = (document.getElementById('k-search')?.value || '').toLowerCase();
  const fBulan     = document.getElementById('k-filterBulan')?.value || '';
  const fKuartal   = document.getElementById('k-filterKuartal')?.value || '';
  const fBidang    = document.getElementById('k-filterBidang')?.value || '';
  const fJenisLJK  = document.getElementById('k-filterJenisLJK')?.value || '';
  const fSuper     = document.getElementById('k-filterSupervisor')?.value || '';
  const fStatus    = document.getElementById('k-filterStatus')?.value || '';
  const fKota      = document.getElementById('k-filterKotaKab')?.value || '';
  
  // 2. Filter data
  let filtered = DATA.kegiatan.filter(k => {
    if (fBulan    && k.bulan          !== fBulan)      return false;
    if (fKuartal  && k.kuartal        !== fKuartal)    return false;
    if (fBidang   && k.bidang         !== fBidang)     return false;
    if (fJenisLJK && k.jenisLJK       !== fJenisLJK)   return false;
    if (fSuper    && k.supervisor     !== fSuper)      return false;
    if (fStatus   && k.statusKegiatan !== fStatus)     return false;
    if (fKota     && k.kotaKab        !== fKota)       return false;
    
    if (search) {
      const nm = (k.namaKegiatan || '').toLowerCase();
      const p = (k.namaPUJK || '').toLowerCase();
      if (!nm.includes(search) && !p.includes(search)) return false;
    }
    return true;
  });
  
  // 3. Sort by tanggal (default asc)
  filtered.sort((a, b) => {
    const da = a.tanggalMulai ? new Date(a.tanggalMulai) : new Date(0);
    const db = b.tanggalMulai ? new Date(b.tanggalMulai) : new Date(0);
    return (da - db) * kelolaSortOrder;
  });
  
  // 4. Update UI
  const cntEl = document.getElementById('k-totalCount');
  if (cntEl) cntEl.textContent = filtered.length;
  
  const tbody = document.getElementById('tbodyKelola');
  if (!tbody) return;
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#999;">Data tidak ditemukan</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtered.map((k, i) => {
    // Tgl
    let tglStr = '—';
    if (k.tanggalMulai) {
      const d = new Date(k.tanggalMulai);
      tglStr = d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    }
    
    // Status color class
    let sc = 'status-belum';
    if (k.statusKegiatan === 'Selesai') sc = 'status-selesai';
    else if (k.statusKegiatan === 'On Progress') sc = 'status-progress';
    
    return `<tr>
      <td>${i + 1}</td>
      <td title="${escHtml(k.namaKegiatan)}">${truncate(k.namaKegiatan, 40)}</td>
      <td title="${escHtml(k.namaPUJK)}">${truncate(k.namaPUJK, 25)}</td>
      <td>${escHtml(k.kotaKab || '—')}</td>
      <td>${escHtml(k.supervisor || '—')}</td>
      <td>${tglStr}</td>
      <td style="padding-right:8px">
        <select class="status-select ${sc}" onchange="updateStatus(${k.rowNumber}, this.value, this)">
          <option value="Belum Mulai" ${k.statusKegiatan === 'Belum Mulai' ? 'selected' : ''}>Belum Mulai</option>
          <option value="On Progress" ${k.statusKegiatan === 'On Progress' ? 'selected' : ''}>On Progress</option>
          <option value="Selesai" ${k.statusKegiatan === 'Selesai' ? 'selected' : ''}>Selesai</option>
        </select>
      </td>
      <td>
        <button class="btn-delete-row" title="Hapus Kegiatan" onclick="confirmDelete(${k.rowNumber}, '${escHtml(k.namaKegiatan).replace(/'/g, "\\'")}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════════
// UBAH STATUS
// ═════════════════════════════════════════════════════════════════
async function updateStatus(rowNumber, newStatus, selectEl) {
  const origClass = selectEl.className;
  selectEl.disabled = true;
  showToast('⏳ Menyimpan status...', 'info');
  
  try {
    const res = await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowNumber, statusKegiatan: newStatus })
    });
    const resData = await res.json();
    
    if (!res.ok) throw new Error(resData.error || 'Gagal mengubah status');
    
    showToast('✅ ' + resData.message, 'success');
    
    // Refresh to get new row numbers and ensure consistency
    await loadData(true); 
  } catch (err) {
    console.error('Update status error:', err);
    showToast('❌ ' + err.message, 'error');
    // Revert class visually
    selectEl.className = origClass; 
    selectEl.disabled = false;
    await loadData(true); // reset
  }
}

// ═════════════════════════════════════════════════════════════════
// HAPUS DATA
// ═════════════════════════════════════════════════════════════════
let rowToDelete = null;

function confirmDelete(rowNumber, namaKegiatan) {
  rowToDelete = rowNumber;
  const modal = document.getElementById('deleteModal');
  const nameEl = document.getElementById('deleteModalName');
  if (modal && nameEl) {
    nameEl.textContent = namaKegiatan || 'Tanpa Nama';
    modal.style.display = 'flex';
  }
}

function closeDeleteModal() {
  rowToDelete = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

async function executeDelete() {
  if (!rowToDelete) return;
  
  const btn = document.getElementById('btnConfirmDelete');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Menghapus...';
  
  try {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowNumber: rowToDelete })
    });
    const resData = await res.json();
    
    if (!res.ok) throw new Error(resData.error || 'Gagal menghapus data');
    
    showToast('✅ ' + resData.message, 'success');
    closeDeleteModal();
    
    // Refresh data! This is critical so rowNumbers are re-calculated
    await loadData(true);
  } catch (err) {
    console.error('Delete error:', err);
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}
