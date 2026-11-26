import { formatJam, formatRupiah, formatTanggal } from './format.js';

// Nomor WA dibaca satu kali dari bisnis.json (lihat layout.js), tidak ditulis ganda.
let nomor = '';

export const setNomorWA = (nilai) => { nomor = nilai; };

export const waLink = (pesan = '') =>
  `https://wa.me/${nomor}${pesan ? `?text=${encodeURIComponent(pesan)}` : ''}`;

/* ---------------------------------------------------------------------
   Pesan konfirmasi pesanan
   --------------------------------------------------------------------- */

/** Satuan di produk.json kadang berbentuk "/ box (min. 30)"; di pesan ditulis "Per box (min. 30)". */
const formatUkuran = (satuan) => (satuan ? satuan.replace(/^\s*\/\s*/, 'Per ') : '-');

/** Teks status pembayaran di baris terakhir rincian. */
function statusPembayaran(o) {
  if (o.ongkirStatus === 'luar') return 'Menunggu konfirmasi ongkir dari admin (belum ada pembayaran)';
  if (o.cash) return 'Bayar tunai di toko';
  return o.sudahBayar ? 'Sudah bayar/scan di web (bukti terlampir)' : 'Menunggu konfirmasi';
}

/**
 * Menyusun pesan WhatsApp dari hasil perhitungan di website.
 * Fungsi ini hanya merangkai teks; semua angka sudah dihitung oleh order-form.js.
 *
 * @param {object} o
 * @param {string} o.nama
 * @param {string} o.tanggal         format ISO "YYYY-MM-DD"
 * @param {string} o.jam             "HH:MM"
 * @param {string} [o.catatan]
 * @param {{nama:string, qty:number, kategori:string, diet:string, satuan:string, ucapan:string, subtotal:number}[]} o.items
 * @param {boolean} o.antar          true = Antar Jasa Kurir
 * @param {string}  [o.cabang]       nama (dan alamat) cabang toko
 * @param {string}  [o.alamat]       alamat kirim (hanya kurir)
 * @param {string}  [o.patokan]      patokan / nomor rumah (hanya kurir)
 * @param {string}  [o.mapsUrl]      link Google Maps (hanya bila GPS dipakai)
 * @param {string}  [o.jarakLabel]   mis. "4,2 km" atau "Estimasi zona 3 – 6 km"
 * @param {'ambil'|'ok'|'luar'} o.ongkirStatus
 * @param {number}  [o.ongkir]
 * @param {number}  o.maxRadiusKm
 * @param {string}  o.metodeBayar    label metode, mis. "QRIS"
 * @param {string}  o.skema          label skema, mis. "DP 50%" / "Lunas 100%"
 * @param {number}  o.subtotal
 * @param {number|null} o.grandTotal       null bila ongkir belum pasti
 * @param {number|null} o.bayarSekarang    null bila ongkir belum pasti
 * @param {number|null} o.sisa             null bila ongkir belum pasti
 * @param {boolean} o.cash
 * @param {boolean} o.sudahBayar     checkbox "sudah scan/transfer" dicentang
 */
export function buatPesanPesanan(o) {
  const luar = o.ongkirStatus === 'luar';
  const tunggu = 'Menunggu konfirmasi admin';

  const rincianItem = o.items.map((i, n) => [
    `*${n + 1}. ${i.nama} (x${i.qty})*`,
    `• Spesifikasi: ${i.kategori || '-'} | ${i.diet || 'Regular'} | ${formatUkuran(i.satuan)}`,
    `• Tulisan di Kue: ${i.ucapan ? `"${i.ucapan}"` : '-'}`,
    `• Subtotal: ${formatRupiah(i.subtotal)}`,
  ].join('\n'));

  const alamatLengkap = o.patokan ? `${o.alamat} (Patokan: ${o.patokan})` : o.alamat;

  let jarakDanOngkir;
  if (!o.antar) jarakDanOngkir = `Ambil di Toko - ${formatRupiah(0)}`;
  else if (luar) jarakDanOngkir = `${o.jarakLabel || `Lebih dari ${o.maxRadiusKm} km`} - Di luar radius ${o.maxRadiusKm} km - Mohon info ongkir`;
  else jarakDanOngkir = `${o.jarakLabel} - ${formatRupiah(o.ongkir)}`;

  const uang = (nilai) => (nilai === null || nilai === undefined ? tunggu : formatRupiah(nilai));

  const pembuka = luar
    ? `Halo Admin Dapur Manis Lestari, lokasi saya berada di luar radius pengiriman reguler (maksimal ${o.maxRadiusKm} km). Saya ingin menanyakan ongkir pengiriman khusus sekaligus konfirmasi pesanan dari website:`
    : 'Halo Admin Dapur Manis Lestari, saya ingin konfirmasi pesanan dari website:';
  const penutup = luar
    ? 'Mohon info ongkir pengiriman ke lokasi saya. Terima kasih!'
    : 'Mohon konfirmasi pesanan saya ya. Terima kasih!';

  return [
    pembuka, '',
    '*DATA PEMESAN*',
    `• Nama: ${o.nama}`,
    `• Tanggal & Jam: ${formatTanggal(o.tanggal)} pukul ${formatJam(o.jam)}`,
    ...(o.catatan ? [`• Catatan: ${o.catatan}`] : []), '',
    '*DETAIL KERANJANG PESANAN*',
    rincianItem.join('\n\n'), '',
    '*PENGIRIMAN & LOKASI*',
    `• Metode Terima: ${o.antar ? 'Antar Jasa Kurir' : 'Ambil di Toko'}`,
    ...(o.cabang ? [`• Cabang Toko: ${o.cabang}`] : []),
    ...(o.antar ? [`• Alamat Kirim: ${alamatLengkap}`] : []),
    ...(o.antar && o.mapsUrl ? [`• Titik Koordinat Maps: ${o.mapsUrl}`] : []),
    `• Jarak & Ongkir: ${jarakDanOngkir}`, '',
    '*RINCIAN PEMBAYARAN (TERHITUNG DI WEB)*',
    `• Metode Bayar: ${o.metodeBayar}`,
    `• Skema Bayar: ${o.skema}`,
    `• Subtotal Produk: ${formatRupiah(o.subtotal)}`,
    `• Ongkos Kirim: ${o.ongkirStatus === 'ok' ? formatRupiah(o.ongkir) : o.ongkirStatus === 'ambil' ? formatRupiah(0) : 'Menunggu konfirmasi admin'}`,
    `• Grand Total: ${luar ? `${tunggu} (Subtotal Produk ${formatRupiah(o.subtotal)} + ongkir)` : uang(o.grandTotal)}`,
    `• Nominal Dibayar Sekarang: ${uang(o.bayarSekarang)}`,
    `• Sisa Pelunasan: ${uang(o.sisa)}`,
    `• Status: ${statusPembayaran(o)}`, '',
    penutup,
  ].join('\n');
}
