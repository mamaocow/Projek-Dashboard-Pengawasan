/**
 * api/submit.js — POST endpoint: Write a new kegiatan row to Google Sheets.
 * Accepts JSON body, validates required fields, auto-generates No/Bulan/Kuartal,
 * and appends a new row to the DATA sheet.
 */

const { getSheetData, appendRow } = require('../lib/sheets');

const BULAN_INDONESIA = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // ── Validation ─────────────────────────────────────────────
    if (!body || !body.namaKegiatan) {
      return res.status(400).json({ error: 'Nama Kegiatan wajib diisi' });
    }
    if (!body.tanggalMulai) {
      return res.status(400).json({ error: 'Tanggal Mulai wajib diisi' });
    }
    if (!body.namaPenginput) {
      return res.status(400).json({ error: 'Nama Penginput wajib diisi' });
    }

    // ── Read current headers & data to determine next No ──────
    const { headers, col, dataRows } = await getSheetData();

    let maxNo = 0;
    for (const row of dataRows) {
      if (!row || !row[0]) continue;
      const no = parseInt(String(row[0]).replace('.0', '').trim());
      if (!isNaN(no) && no > maxNo) maxNo = no;
    }
    const nextNo = maxNo + 1;

    // ── Auto-calculate Bulan and Kuartal from Tanggal Mulai ───
    const tglMulai = new Date(body.tanggalMulai);
    const bulan = BULAN_INDONESIA[tglMulai.getMonth() + 1] || '';
    const kuartal = `Q${Math.floor(tglMulai.getMonth() / 3) + 1}`;

    // ── Build row array matching the spreadsheet column order ─
    const newRow = new Array(headers.length).fill('');

    const setCol = (name, value) => {
      if (col[name] !== undefined) newRow[col[name]] = value || '';
    };

    setCol('No', nextNo);
    setCol('Nama Bank / Kegiatan Pengawasan', body.namaKegiatan || '');
    setCol('Nama PUJK', body.namaPUJK || '');
    setCol('Kota/Kab', body.kotaKab || '');
    setCol('Bidang', body.bidang || '');
    setCol('Sektor', body.bidang || ''); // fallback column name
    setCol('Jenis Kegiatan', body.jenisKegiatan || '');
    setCol('Kuartal (Q)', kuartal);
    setCol('Bulan', bulan);
    setCol('Tanggal Mulai', body.tanggalMulai || '');
    setCol('Tanggal Selesai', body.tanggalSelesai || '');
    setCol('Supervisor', body.supervisor || '');
    setCol('Status Kegiatan', body.statusKegiatan || 'Belum Mulai');
    setCol('Anggota 1', body.anggota1 || '');
    setCol('Anggota 2', body.anggota2 || '');
    setCol('Anggota 3', body.anggota3 || '');
    setCol('Anggota 4', body.anggota4 || '');

    // Append "Nama Penginput" at end if column doesn't exist in headers
    if (col['Nama Penginput'] !== undefined) {
      newRow[col['Nama Penginput']] = body.namaPenginput || '';
    } else {
      // Add it beyond the last header column
      newRow.push(body.namaPenginput || '');
    }

    // ── Write to Google Sheets ────────────────────────────────
    await appendRow(newRow);

    return res.status(200).json({
      success: true,
      message: `Kegiatan berhasil ditambahkan (No. ${nextNo})`,
      no: nextNo,
    });
  } catch (err) {
    console.error('Error submitting data:', err);
    return res.status(500).json({
      error: 'Gagal menyimpan data ke Google Sheets',
      details: err.message,
    });
  }
};
