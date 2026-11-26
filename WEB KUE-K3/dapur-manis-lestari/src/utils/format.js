export const formatRupiah = (angka) => 'Rp ' + Number(angka).toLocaleString('id-ID');

/** Mengamankan teks dari data sebelum disisipkan ke HTML. */
export const escapeHTML = (teks) =>
  String(teks).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** "2026-12-24" → "Kamis, 24 Desember 2026". Kosong bila belum diisi. */
export const formatTanggal = (iso) => (iso
  ? new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : '');

/** "14:30" → "14.30 WIB". Kosong bila belum diisi. */
export const formatJam = (jam) => (jam ? `${jam.replace(':', '.')} WIB` : '');

/** 4.2 → "4,2 km" */
export const formatJarak = (km) =>
  `${Number(km).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

/** "004501089234532" → "0045 0108 9234 532" (tampilan saja; salin selalu memakai angka asli tanpa spasi). */
export const formatNomorRekening = (nomor) => String(nomor).replace(/\D/g, '').replace(/(.{4})(?=.)/g, '$1 ');
