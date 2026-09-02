/**
 * api/update-status.js — POST endpoint: Update status kegiatan in Google Sheets.
 * Body: { rowNumber, statusKegiatan }
 */

const { updateCell } = require('../lib/sheets');

const VALID_STATUSES = ['Belum Mulai', 'On Progress', 'Selesai'];

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
    if (!body || typeof body.rowNumber !== 'number' || body.rowNumber <= 0) {
      return res.status(400).json({ error: 'rowNumber harus berupa angka > 0' });
    }
    if (!body.statusKegiatan || !VALID_STATUSES.includes(body.statusKegiatan)) {
      return res.status(400).json({
        error: `statusKegiatan harus salah satu dari: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // ── Update cell in Google Sheets ──────────────────────────
    await updateCell(body.rowNumber, 'Status Kegiatan', body.statusKegiatan);

    return res.status(200).json({
      success: true,
      message: 'Status berhasil diubah',
    });
  } catch (err) {
    console.error('Error updating status:', err);
    return res.status(500).json({
      error: 'Gagal mengubah status di Google Sheets',
      details: err.message,
    });
  }
};
