/**
 * api/data.js — GET endpoint: Read data from Google Sheets and return JSON.
 * Replaces the old server.py real-time fetch logic.
 * Response format is identical to the old data/data.json structure.
 */

const { getSheetData } = require('../lib/sheets');

// ─── Constants ────────────────────────────────────────────────────────────────

const BULAN_INDONESIA = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

const BULAN_KE_ANGKA = {};
Object.entries(BULAN_INDONESIA).forEach(([k, v]) => {
  BULAN_KE_ANGKA[v.toLowerCase()] = parseInt(k);
});

const BULAN_ENGLISH = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Defensively parse a date value from Google Sheets.
 * Handles: ISO strings, "14 Januari 2026", "DD/MM/YYYY", "DD-MM-YYYY",
 * Excel serial numbers, and various other formats.
 */
function parseTanggal(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || ['none', 'nan', '-'].includes(s.toLowerCase())) return null;

  // ISO: 2026-01-13 or 2026-01-13T...
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);

  // "14 Januari 2026" or "14 January 2026"
  const parts = s.split(/\s+/);
  if (parts.length >= 3) {
    const d = parseInt(parts[0]);
    const mStr = parts[1].toLowerCase();
    const y = parseInt(parts[2]);
    if (!isNaN(d) && !isNaN(y)) {
      if (BULAN_KE_ANGKA[mStr]) return new Date(y, BULAN_KE_ANGKA[mStr] - 1, d);
      if (BULAN_ENGLISH[mStr]) return new Date(y, BULAN_ENGLISH[mStr] - 1, d);
    }
  }

  // DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return new Date(+slash[3], +slash[2] - 1, +slash[1]);

  // DD-MM-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dash) return new Date(+dash[3], +dash[2] - 1, +dash[1]);

  // MM/DD/YYYY (Google Sheets US locale format)
  const usDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  // Already handled above — skip duplicate

  // Excel serial date
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 1 && serial < 200000) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + serial * 86400000);
  }

  // Last resort: native parse
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 2000) return fallback;

  return null;
}

function formatDateISO(date) {
  if (!date || isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { col, dataRows, headerIdx } = await getSheetData();

    const kegiatan = [];
    const hariLibur = [];
    const dateWarnings = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i];
      // rowNumber = physical 1-based row in Google Sheet
      // headerIdx is 0-based index of header row, data starts at headerIdx+1,
      // Sheets rows are 1-based, so first data row = headerIdx + 1 + 1 = headerIdx + 2
      const rowNumber = headerIdx + 2 + i;

      const getVal = (name) => {
        const idx = col[name];
        if (idx === undefined || !cells || idx >= cells.length) return null;
        return cells[idx];
      };

      // Skip entirely empty rows
      if (!cells || cells.every(c => !c || String(c).trim() === '')) continue;

      const noStr = cleanStr(getVal('No')).replace('.0', '').trim();
      const namaKeg = cleanStr(getVal('Nama Bank / Kegiatan Pengawasan'));
      const namaPujk = cleanStr(getVal('Nama PUJK'));
      const kota = cleanStr(getVal('Kota/Kab'));
      const tglMulaiRaw = getVal('Tanggal Mulai');

      // Detect holiday/cuti rows (no PUJK, no Kota, no Tanggal Mulai, but has namaKeg)
      if (namaKeg && !namaPujk && !kota && !tglMulaiRaw) {
        hariLibur.push({ no: noStr, keterangan: namaKeg });
        continue;
      }

      if (!namaKeg) continue;

      const tglMulai = parseTanggal(tglMulaiRaw);
      // Handle column name with or without trailing space
      const tglSelesai = parseTanggal(getVal('Tanggal Selesai') || getVal('Tanggal Selesai '));

      // Date validation warning
      let dateWarning = false;
      if (tglMulai && tglSelesai && tglSelesai < tglMulai) {
        const label = `No=${noStr} '${namaKeg.substring(0, 40)}'`;
        dateWarnings.push(`${label}: Tanggal Selesai < Tanggal Mulai`);
        dateWarning = true;
      }

      // Calculate bulan from Tanggal Mulai (primary) or Bulan column (fallback)
      let bulan = '';
      if (tglMulai) {
        bulan = BULAN_INDONESIA[tglMulai.getMonth() + 1] || '';
      } else {
        const bulanRaw = cleanStr(getVal('Bulan')).toLowerCase();
        if (BULAN_KE_ANGKA[bulanRaw]) bulan = BULAN_INDONESIA[BULAN_KE_ANGKA[bulanRaw]] || '';
        else if (BULAN_ENGLISH[bulanRaw]) bulan = BULAN_INDONESIA[BULAN_ENGLISH[bulanRaw]] || '';
      }

      // Calculate kuartal
      let kuartal = cleanStr(getVal('Kuartal (Q)'));
      if (!kuartal && tglMulai) {
        kuartal = `Q${Math.floor(tglMulai.getMonth() / 3) + 1}`;
      }

      // Anggota tim
      const anggota = [];
      ['Anggota 1', 'Anggota 2', 'Anggota 3', 'Anggota 4'].forEach(key => {
        const a = cleanStr(getVal(key));
        if (a) anggota.push(a);
      });

      kegiatan.push({
        rowNumber,
        no: noStr,
        namaKegiatan: namaKeg,
        namaPUJK: namaPujk,
        kotaKab: kota,
        bidang: cleanStr(getVal('Bidang') || getVal('Sektor') || ''),
        jenisLJK: cleanStr(getVal('Jenis LJK')),
        jenisKegiatan: cleanStr(getVal('Jenis Kegiatan')),
        kuartal,
        bulan,
        tanggalMulai: formatDateISO(tglMulai),
        tanggalSelesai: formatDateISO(tglSelesai),
        supervisor: cleanStr(getVal('Supervisor')),
        statusKegiatan: cleanStr(getVal('Status Kegiatan')),
        anggota,
        dateWarning,
      });
    }

    // Top 10 PUJK by frequency
    const pujkCounter = {};
    const pujkLookup = {};
    for (const k of kegiatan) {
      if (k.namaPUJK) {
        pujkCounter[k.namaPUJK] = (pujkCounter[k.namaPUJK] || 0) + 1;
        if (!pujkLookup[k.namaPUJK]) {
          pujkLookup[k.namaPUJK] = { bidang: k.bidang, jenisLJK: k.jenisLJK };
        }
      }
    }

    const topPUJK = Object.entries(pujkCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nama, jumlah]) => ({
        nama,
        jumlah,
        bidang: (pujkLookup[nama] || {}).bidang || '',
        jenisLJK: (pujkLookup[nama] || {}).jenisLJK || '',
      }));

    const output = {
      kegiatan,
      hariLibur,
      topPUJK,
      metadata: {
        totalKegiatan: kegiatan.length,
        tanggalGenerate: new Date().toISOString(),
        sumber: 'Google Sheets API v4',
        warnings: dateWarnings,
      },
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(output);
  } catch (err) {
    console.error('Error fetching sheet data:', err);
    return res.status(500).json({
      error: 'Gagal mengambil data dari Google Sheets',
      details: err.message,
    });
  }
};
