/**
 * api/delete.js — POST endpoint: Delete a kegiatan row from Google Sheets.
 * Body: { rowNumber }
 */

const { deleteRow } = require('../lib/sheets');

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
    if (!body || typeof body.rowNumber !== 'number' || body.rowNumber <= 1) {
      return res.status(400).json({
        error: 'rowNumber harus berupa angka valid > 1 (tidak boleh menghapus header)',
      });
    }

    // ── Delete row from Google Sheets ─────────────────────────
    await deleteRow(body.rowNumber);

    return res.status(200).json({
      success: true,
      message: 'Kegiatan berhasil dihapus',
    });
  } catch (err) {
    console.error('Error deleting row:', err);
    return res.status(500).json({
      error: 'Gagal menghapus data dari Google Sheets',
      details: err.message,
    });
  }
};
