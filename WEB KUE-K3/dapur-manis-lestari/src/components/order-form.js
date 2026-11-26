import { escapeHTML, formatJam, formatJarak, formatNomorRekening, formatRupiah, formatTanggal } from '../utils/format.js';
import { ASSETS_URL, pageUrl } from '../utils/paths.js';
import { buatPesanPesanan, waLink } from '../utils/whatsapp.js';
import {
  MAX_RADIUS_KM, ZONA_MANUAL, adaKoordinat, ambilLokasiGPS, cariAlamatDariKoordinat,
  hitungJarakKm, hitungOngkir, linkGoogleMaps, urutkanCabangTerdekat,
} from '../utils/lokasi.js';
import { addItem, bacaItem, getItems, getSubtotal, itemValid, renderCartItems, subscribe, ubahDetail } from './cart.js';
import { showToast } from './toast.js';

const PEMBAYARAN_BAWAAN = { dpPersen: 50, pelunasanHari: 'H-1' };

const PESAN_LUAR_RADIUS = `Maaf, lokasi Anda berada di luar jangkauan pengiriman reguler kami (maksimal ${MAX_RADIUS_KM} km). Silakan pilih 'Ambil di Toko' atau hubungi Admin via WhatsApp untuk pengiriman khusus.`;

const hariIniISO = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/**
 * Menghitung tagihan berdasarkan skema pembayaran.
 * @param {number} total       Grand Total (produk + ongkir)
 * @param {'dp'|'lunas'} tipe
 * @param {number} dpPersen    persentase DP (mis. 50)
 */
export function hitungTagihan(total, tipe, dpPersen) {
  const jumlah = Number.isFinite(Number(total)) ? Number(total) : 0; // tidak pernah NaN
  if (tipe === 'lunas') return { tipe, label: 'Lunas 100%', bayarSekarang: jumlah, sisa: 0 };
  const dp = Math.ceil((jumlah * dpPersen) / 100);
  return { tipe: 'dp', label: `DP ${dpPersen}%`, bayarSekarang: dp, sisa: jumlah - dp };
}

const METODE_BAYAR = { qris: 'QRIS', transfer: 'Transfer Bank', cash: 'Cash di Toko' };

/* ---------- QRIS ----------
   CARA MENGGANTI GAMBAR QRIS:
   1. Simpan gambar QRIS toko (PNG/JPG, idealnya persegi ≥ 600×600 px) sebagai  src/assets/qris.png
   2. Atau pakai nama/lokasi lain: ubah  pembayaran.qris.gambar  di src/data/bisnis.json
      (nama berkas di src/assets/, atau URL https://… penuh).
   Selama berkas belum ada, tampil gambar CONTOH di bawah (bukan QRIS asli, tidak bisa dipakai membayar). */
const urlGambarQris = (nama = 'qris.png') => (/^https?:\/\//.test(nama) ? nama : `${ASSETS_URL}${nama}`);

/** Gambar contoh mirip QRIS (data-URI SVG, tanpa berkas/jaringan). Pola tetap, bukan kode yang bisa dipindai. */
function gambarQrisContoh() {
  const n = 29;
  let seed = 7;
  const acak = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const penanda = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#820527"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#FAF4E4"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#820527"/>`;
  const dalamPenanda = (x, y) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  let modul = '';
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) if (!dalamPenanda(x, y) && acak() > 0.52) modul += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#FAF4E4"/><g fill="#820527">${modul}</g>${penanda(0, 0)}${penanda(n - 7, 0)}${penanda(0, n - 7)}<rect x="3" y="10.5" width="23" height="8" fill="#F8C4C4"/><text x="14.5" y="13.9" font-family="sans-serif" font-size="3" font-weight="700" text-anchor="middle" textLength="12" lengthAdjust="spacingAndGlyphs" fill="#820527">CONTOH</text><text x="14.5" y="17" font-family="sans-serif" font-size="2.2" font-weight="700" text-anchor="middle" textLength="19" lengthAdjust="spacingAndGlyphs" fill="#820527">BUKAN QRIS ASLI</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Menyalin teks ke clipboard (dengan cadangan untuk browser lama / koneksi non-HTTPS). */
async function salinTeks(teks, pesan) {
  try {
    await navigator.clipboard.writeText(teks);
  } catch {
    const area = document.createElement('textarea');
    area.value = teks;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* abaikan */ }
    area.remove();
    if (!ok) { showToast('Gagal menyalin, salin manual ya'); return; }
  }
  showToast(pesan);
}

/**
 * @param {HTMLElement} container
 * @param {object[]} daftarProduk
 * @param {{dpPersen:number, pelunasanHari:string, metode:object[], qris?:{gambar?:string, namaMerchant?:string}}} pembayaran  dari bisnis.json
 * @param {{id:string, nama:string}[]} daftarKategori  untuk menampilkan nama kategori di pesan
 * @param {{id:string, nama:string, alamat:string, jam:string, lat:number, lng:number}[]} daftarCabang  dari cabang.json
 */
export function renderOrderSection(container, daftarProduk, pembayaran = PEMBAYARAN_BAWAAN, daftarKategori = [], daftarCabang = []) {
  const bayar = { ...PEMBAYARAN_BAWAAN, ...pembayaran };
  const namaKategori = Object.fromEntries(daftarKategori.map((k) => [k.id, k.nama]));
  const rekening = (bayar.metode || []).filter((m) => m.jenis === 'bank');
  const pilihan = daftarProduk.filter(itemValid)
    .map((p) => `<option value="${p.id}">${escapeHTML(p.nama)} — ${formatRupiah(p.harga)}</option>`).join('');
  const opsiZona = ZONA_MANUAL.map((z) => `<option value="${z.id}">${escapeHTML(z.label)}</option>`).join('');
  const opsiBank = rekening.map((m, i) => `
    <label><input type="radio" name="bank" value="${i}"${i === 0 ? ' checked' : ''}> ${escapeHTML(m.nama)}</label>`).join('');

  container.innerHTML = `
    <div class="order-layout">
      <div class="card stack">
        <h3>🛒 Keranjang Anda</h3>
        <div class="order-add">
          <select id="order-produk" aria-label="Pilih produk">${pilihan}</select>
          <button class="btn btn--soft btn--sm" type="button" id="order-tambah">+ Tambah</button>
        </div>
        <div class="stack" id="order-items"></div>
        <div class="cart__total"><span>Subtotal Produk</span><strong id="order-total"></strong></div>
        <a class="btn btn--soft btn--sm" href="${pageUrl('produk')}">Lihat katalog lengkap</a>
      </div>

      <form class="card stack" id="order-form" novalidate>
        <h3>📝 Formulir Pemesanan</h3>
        <label class="field">Nama lengkap *<input name="nama" type="text" autocomplete="name" required></label>
        <div class="field-row">
          <label class="field">Tanggal ambil / kirim *<input name="tanggal" type="date" min="${hariIniISO()}" required></label>
          <label class="field">Jam *<input name="jam" type="time" required></label>
        </div>

        <fieldset class="field field--radio">
          <legend>Metode terima</legend>
          <label><input type="radio" name="metode" value="ambil" checked> Ambil di toko</label>
          <label><input type="radio" name="metode" value="antar"> Antar jasa kurir</label>
        </fieldset>

        ${daftarCabang.length ? `
        <label class="field" id="field-cabang"><span id="label-cabang">Ambil di cabang</span>
          <select name="cabang">${daftarCabang.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nama)}</option>`).join('')}</select>
        </label>` : ''}

        <!-- Ambil di toko: ongkir Rp 0 + jadwal pengambilan -->
        <div class="alert alert--ok" id="info-ambil" aria-live="polite"></div>

        <!-- Antar jasa kurir: lokasi & alamat -->
        <div class="ship-block stack" id="blok-antar" hidden>
          <h4>📍 Lokasi &amp; Alamat Pengiriman</h4>
          <button class="btn btn--soft btn--block" type="button" id="btn-gps">📍 Gunakan Lokasi Saya Saat Ini</button>
          <p class="geo-status" id="gps-status" role="status" aria-live="polite" hidden></p>
          <button class="link link--btn" type="button" id="btn-reset-gps" hidden>Hapus lokasi GPS &amp; pilih estimasi jarak manual</button>
          <label class="field">Alamat lengkap *<textarea name="alamat" rows="3" autocomplete="street-address" placeholder="Terisi otomatis dari GPS, atau ketik jalan, RT/RW, kelurahan, kecamatan"></textarea></label>
          <label class="field">Detail patokan / nomor rumah<input name="patokan" type="text" autocomplete="off" placeholder="Mis. No. 12, pagar hijau, depan Indomaret"></label>
          <label class="field" id="blok-zona">Estimasi jarak (bila tidak memakai GPS)
            <select name="zona"><option value="">— Pilih estimasi jarak —</option>${opsiZona}</select>
          </label>
          <div class="alert" id="hasil-jarak" role="status" aria-live="polite" hidden></div>
        </div>

        <label class="field">Catatan tambahan (alergi, tema warna)<textarea name="catatan" rows="2" placeholder="Opsional"></textarea></label>

        <fieldset class="field field--radio pay-options" id="skema-bayar">
          <legend>Skema pembayaran</legend>
          <label class="pay-option">
            <input type="radio" name="pembayaran" value="dp" checked>
            <span><strong>DP ${bayar.dpPersen}%</strong><small data-nominal="dp"></small></span>
          </label>
          <label class="pay-option">
            <input type="radio" name="pembayaran" value="lunas">
            <span><strong>Bayar Lunas (100%)</strong><small data-nominal="lunas"></small></span>
          </label>
        </fieldset>

        <fieldset class="field field--radio">
          <legend>Metode pembayaran</legend>
          <label><input type="radio" name="bayar" value="qris" checked> QRIS</label>
          <label><input type="radio" name="bayar" value="transfer"> Transfer Bank</label>
          <label id="opsi-cash"><input type="radio" name="bayar" value="cash"> Cash (bayar di toko)</label>
        </fieldset>

        <div class="pay-summary" aria-live="polite">
          <div><span>Subtotal Produk</span><strong data-r="subtotal"></strong></div>
          <div><span data-r="label-ongkir"></span><strong data-r="ongkir"></strong></div>
          <div class="pay-summary__total"><span>Grand Total</span><strong data-r="grand"></strong></div>
          <div class="pay-summary__now"><span data-r="label-sekarang"></span><strong data-r="sekarang"></strong></div>
          <div><span>Sisa Tagihan (Pelunasan)</span><strong data-r="sisa"></strong></div>
          <p class="muted" data-r="catatan"></p>
        </div>

        <!-- Panel pembayaran: hanya satu yang tampil sesuai metode & status ongkir -->
        <div class="pay-panel" id="panel-terkunci" hidden></div>

        <div class="pay-panel qris-box" id="panel-qris" hidden>
          <h4>🔳 Scan QRIS</h4>
          <img class="qris-box__img" id="qris-img" src="${escapeHTML(urlGambarQris(bayar.qris?.gambar))}" alt="Kode QRIS ${escapeHTML(bayar.qris?.namaMerchant || 'Dapur Manis Lestari')}" width="320" height="320">
          <p class="qris-box__warn" id="qris-contoh" hidden>⚠️ Ini gambar contoh. Simpan QRIS asli toko di <code>src/assets/qris.png</code>.</p>
          ${bayar.qris?.namaMerchant ? `<p class="muted">a.n. ${escapeHTML(bayar.qris.namaMerchant)}</p>` : ''}
          <p class="pay-big__label" data-r="label-besar"></p>
          <p class="pay-big" data-r="besar"></p>
          <button class="btn btn--soft btn--sm" type="button" data-salin-nominal>Salin Nominal</button>
          <p class="muted">Masukkan nominal di atas saat membayar. Setelah selesai, simpan bukti pembayaran untuk dilampirkan di WhatsApp.</p>
          <label class="check"><input type="checkbox" name="konfirmQris"> <span>Saya sudah scan &amp; bayar via QRIS (siap lampirkan bukti di WhatsApp)</span></label>
        </div>

        <div class="pay-panel" id="panel-transfer" hidden>
          <h4>🏦 Transfer Bank</h4>
          ${rekening.length ? `
          ${rekening.length > 1 ? `<fieldset class="field field--radio bank-choices"><legend>Pilih bank tujuan</legend>${opsiBank}</fieldset>` : ''}
          <div class="bank-detail" id="bank-detail"></div>` : '<p class="muted">Rekening belum diatur. Hubungi admin via WhatsApp.</p>'}
          <p class="pay-big__label" data-r="label-besar"></p>
          <p class="pay-big" data-r="besar"></p>
          <button class="btn btn--soft btn--sm" type="button" data-salin-nominal>Salin Nominal</button>
          <label class="check"><input type="checkbox" name="konfirmTransfer"> <span>Saya sudah transfer (siap lampirkan bukti di WhatsApp)</span></label>
        </div>

        <div class="pay-panel" id="panel-cash" hidden>
          <h4>💵 Bayar Tunai di Toko</h4>
          <p data-r="cash-info"></p>
          <p class="muted">Skema otomatis diatur ke bayar penuh (Lunas 100%) saat pengambilan. Tidak perlu membayar apa pun di website.</p>
        </div>

        <p class="form-error" id="order-error" role="alert" hidden></p>
        <button class="btn btn--wa btn--block" type="submit" id="btn-kirim">Kirim Konfirmasi via WhatsApp</button>
        <p class="muted order-note">WhatsApp hanya untuk konfirmasi akhir &amp; melampirkan bukti pembayaran; seluruh perhitungan sudah dilakukan di website.</p>
      </form>
    </div>`;

  /* ---------- Referensi elemen & state ---------- */
  const $ = (selector) => container.querySelector(selector);
  const form = $('#order-form');
  const error = $('#order-error');
  const state = { skema: 'dp', gps: null, alamatOtomatis: '' };

  const set = (selector, nilai) => { const el = $(selector); if (el.textContent !== nilai) el.textContent = nilai; };
  const tampil = (selector, terlihat) => { $(selector).hidden = !terlihat; };

  /* ---------- Perhitungan ---------- */
  const cabangDipilih = () => daftarCabang.find((c) => c.id === form.cabang?.value) || null;

  /** Jarak GPS (km) dari cabang terpilih ke pembeli, atau null bila GPS belum aktif / cabang tanpa koordinat. */
  const jarakGPS = (cabang) => (state.gps && adaKoordinat(cabang) ? hitungJarakKm(cabang, state.gps) : null);

  /**
   * Menentukan status ongkir pengiriman kurir.
   *  - 'ok'    : jarak ≤ MAX_RADIUS_KM, ongkir terhitung otomatis
   *  - 'luar'  : jarak > MAX_RADIUS_KM → ongkir "Konfirmasi Admin", pembayaran online dikunci
   *  - 'belum' : lokasi belum ditentukan (belum GPS dan belum pilih zona)
   */
  function tentukanOngkir(cabang, zonaId) {
    const dariGPS = jarakGPS(cabang);
    let jarak = dariGPS;
    let jarakLabel = dariGPS === null ? '' : formatJarak(dariGPS);
    let label = jarakLabel;
    if (dariGPS === null) {
      const zona = ZONA_MANUAL.find((z) => z.id === zonaId);
      if (!zona) return { status: 'belum', ongkir: null, jarak: null, jarakLabel: '', label: 'belum dihitung' };
      if (zona.luar) return { status: 'luar', ongkir: null, jarak: null, jarakLabel: `Estimasi: ${zona.label}`, label: 'di luar radius' };
      jarak = zona.maksKm;
      jarakLabel = `Estimasi zona ${zona.label}`;
      label = `zona ${zona.label}`;
    }
    if (jarak > MAX_RADIUS_KM) return { status: 'luar', ongkir: null, jarak, jarakLabel, label: `${label}, di luar radius` };
    return { status: 'ok', ongkir: hitungOngkir(jarak), jarak, jarakLabel, label };
  }

  function hitungPesanan() {
    const antar = form.metode.value === 'antar';
    const cabang = cabangDipilih();
    const lokasi = antar
      ? tentukanOngkir(cabang, form.zona.value)
      : { status: 'ambil', ongkir: 0, jarak: null, jarakLabel: '', label: 'Ambil di Toko' };
    const cash = !antar && form.bayar.value === 'cash';
    const skema = cash ? 'lunas' : state.skema; // Cash selalu bayar penuh di toko
    const siap = lokasi.status === 'ambil' || lokasi.status === 'ok';
    const subtotal = getSubtotal();
    const grandTotal = siap ? subtotal + lokasi.ongkir : null;
    const tagihan = siap ? hitungTagihan(grandTotal, skema, bayar.dpPersen) : null;
    return { antar, cabang, lokasi, cash, skema, siap, subtotal, grandTotal, tagihan };
  }

  const labelSkema = (p) => (p.skema === 'dp' ? `DP ${bayar.dpPersen}%` : 'Lunas 100%');

  /* ---------- Tampilan ---------- */
  function renderBankDetail() {
    const el = $('#bank-detail');
    if (!el) return;
    const m = rekening[Number(form.bank?.value ?? 0)] || rekening[0];
    el.innerHTML = `
      <p class="bank-detail__name">${escapeHTML(m.nama)}</p>
      <p class="pay-method__number" aria-label="Nomor rekening ${escapeHTML(m.nomor)}">${escapeHTML(formatNomorRekening(m.nomor))}</p>
      <p class="muted">a.n. ${escapeHTML(m.atasNama || '')}</p>
      <button class="btn btn--soft btn--sm" type="button" data-salin-rekening="${escapeHTML(String(m.nomor).replace(/\D/g, ''))}">Salin Nomor Rekening</button>`;
  }

  /** Menampilkan jarak ke tiap cabang pada daftar pilihan cabang (titik = null → tanpa jarak). */
  function isiOpsiCabang(titik) {
    if (!form.cabang) return;
    const pilihan = form.cabang.value;
    form.cabang.innerHTML = daftarCabang.map((c) => {
      const km = titik && adaKoordinat(c) ? ` — ${formatJarak(hitungJarakKm(c, titik))}` : '';
      return `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nama)}${km}</option>`;
    }).join('');
    if (pilihan) form.cabang.value = pilihan;
  }

  function perbarui() {
    // Cash hanya untuk ambil di toko: jika kurir dipilih, pindahkan otomatis ke QRIS.
    const antarSekarang = form.metode.value === 'antar';
    if (antarSekarang && form.bayar.value === 'cash') form.bayar.value = 'qris';
    $('#opsi-cash input').disabled = antarSekarang;
    tampil('#opsi-cash', !antarSekarang);

    const p = hitungPesanan();
    const metodeBayar = form.bayar.value;

    // Lokasi & jadwal
    tampil('#blok-antar', p.antar);
    tampil('#info-ambil', !p.antar);
    if (daftarCabang.length) set('#label-cabang', p.antar ? 'Cabang pengirim (terdekat dari lokasi Anda)' : 'Ambil di cabang');
    tampil('#blok-zona', p.antar && jarakGPS(p.cabang) === null);
    tampil('#btn-reset-gps', Boolean(state.gps));

    if (!p.antar) {
      const tgl = formatTanggal(form.tanggal.value) || 'tanggal belum dipilih';
      const jam = formatJam(form.jam.value) || 'jam belum dipilih';
      const lokasiToko = p.cabang ? `${p.cabang.nama}, ${p.cabang.alamat}` : 'toko kami';
      set('#info-ambil', `🏪 Ambil di toko — ongkos kirim ${formatRupiah(0)}. Pengambilan: ${tgl}, pukul ${jam}. Lokasi: ${lokasiToko}.`);
    }

    const kotak = $('#hasil-jarak');
    kotak.hidden = !p.antar;
    if (p.antar) {
      kotak.className = `alert ${{ ok: 'alert--ok', luar: 'alert--danger', belum: 'alert--info' }[p.lokasi.status]}`;
      const namaCabang = p.cabang ? ` ke ${p.cabang.nama}` : '';
      if (p.lokasi.status === 'ok') kotak.textContent = `📏 Jarak${namaCabang}: ${p.lokasi.jarakLabel} — ongkos kirim ${formatRupiah(p.lokasi.ongkir)}`;
      else if (p.lokasi.status === 'luar') kotak.textContent = `⚠️ ${PESAN_LUAR_RADIUS}`;
      else kotak.textContent = 'Gunakan lokasi GPS atau pilih estimasi jarak agar ongkos kirim dapat dihitung.';
    }

    // Skema DP / Lunas (Cash mengunci ke Lunas)
    form.pembayaran.value = p.skema;
    container.querySelectorAll('input[name="pembayaran"]').forEach((el) => {
      el.disabled = p.cash;
      el.closest('label').classList.toggle('is-disabled', p.cash);
    });
    const dp = p.siap ? hitungTagihan(p.grandTotal, 'dp', bayar.dpPersen).bayarSekarang : null;
    set('[data-nominal="dp"]', dp === null ? '—' : formatRupiah(dp));
    set('[data-nominal="lunas"]', p.siap ? formatRupiah(p.grandTotal) : '—');

    // Ringkasan biaya
    set('[data-r="subtotal"]', formatRupiah(p.subtotal));
    set('[data-r="label-ongkir"]', `Ongkos Kirim (${p.lokasi.label})`);
    set('[data-r="ongkir"]', { ambil: formatRupiah(0), ok: formatRupiah(p.lokasi.ongkir ?? 0), luar: 'Konfirmasi Admin', belum: '—' }[p.lokasi.status]);
    set('[data-r="grand"]', p.siap ? formatRupiah(p.grandTotal) : (p.lokasi.status === 'luar' ? 'Menunggu ongkir' : '—'));
    const labelBayar = p.cash ? 'Lunas 100%, di kasir toko' : labelSkema(p);
    set('[data-r="label-sekarang"]', `Nominal Dibayar Sekarang (${labelBayar})`);
    set('[data-r="sekarang"]', p.siap ? formatRupiah(p.tagihan.bayarSekarang) : '—');
    set('[data-r="sisa"]', p.siap ? formatRupiah(p.tagihan.sisa) : '—');
    set('[data-r="catatan"]', p.lokasi.status === 'luar'
      ? 'Total akan dikonfirmasi admin setelah ongkir pengiriman khusus disepakati.'
      : `Ongkir adalah estimasi dari jarak garis lurus; admin dapat menyesuaikan bila ada ornamen khusus atau rute berbeda.${p.skema === 'dp' && p.siap ? ` Sisa dilunasi paling lambat ${bayar.pelunasanHari}.` : ''}`);

    // Panel pembayaran
    const terkunci = $('#panel-terkunci');
    terkunci.hidden = p.siap;
    if (!p.siap) {
      terkunci.className = `pay-panel alert ${p.lokasi.status === 'luar' ? 'alert--danger' : 'alert--info'}`;
      terkunci.textContent = p.lokasi.status === 'luar'
        ? '🔒 QRIS & Transfer dinonaktifkan sementara. Jangan transfer dulu sebelum admin menyepakati ongkir pengiriman khusus.'
        : '🔒 Lengkapi lokasi pengiriman terlebih dahulu agar nominal pembayaran dapat dihitung.';
    }
    tampil('#panel-qris', p.siap && !p.cash && metodeBayar === 'qris');
    tampil('#panel-transfer', p.siap && !p.cash && metodeBayar === 'transfer');
    tampil('#panel-cash', p.siap && p.cash);
    if (p.siap) {
      container.querySelectorAll('[data-r="besar"]').forEach((el) => { el.textContent = formatRupiah(p.tagihan.bayarSekarang); });
      container.querySelectorAll('[data-r="label-besar"]').forEach((el) => { el.textContent = `Nominal yang harus dibayar sekarang (${labelBayar})`; });
      container.querySelectorAll('[data-salin-nominal]').forEach((el) => { el.dataset.nominal = String(p.tagihan.bayarSekarang); });
      set('[data-r="cash-info"]', `Bayar ${formatRupiah(p.grandTotal)} di kasir ${p.cabang ? p.cabang.nama : 'toko'} saat pengambilan${p.cabang?.jam && /\d/.test(p.cabang.jam) ? ` (jam buka ${p.cabang.jam})` : ''}.`);
    }

    // Tombol WhatsApp
    set('#btn-kirim', p.lokasi.status === 'luar' ? 'Tanya Ongkir Luar Radius ke Admin' : 'Kirim Konfirmasi via WhatsApp');
  }

  /* ---------- Validasi & pesan ---------- */
  function validasi(data, p) {
    if (!getItems().length || getSubtotal() <= 0) return 'Keranjang masih kosong. Tambahkan produk terlebih dahulu.';
    if (!data.nama) return 'Nama lengkap wajib diisi.';
    if (!data.tanggal) return 'Tanggal pengambilan/pengiriman wajib diisi.';
    if (!data.jam) return 'Jam pengambilan/pengiriman wajib diisi.';
    if (p.antar && !data.alamat) return 'Alamat pengiriman wajib diisi.';
    if (p.antar && p.lokasi.status === 'belum') return 'Gunakan lokasi GPS atau pilih estimasi jarak agar ongkir dapat dihitung.';
    if (p.antar && data.bayar === 'cash') return 'Pembayaran Cash hanya untuk ambil di toko.';
    return '';
  }

  function susunOrder(data, p) {
    const bank = rekening[Number(form.bank?.value ?? 0)];
    const sudahBayar = p.siap && !p.cash
      && ((data.bayar === 'qris' && form.konfirmQris.checked) || (data.bayar === 'transfer' && form.konfirmTransfer.checked));
    const labelMetode = data.bayar === 'transfer' && bank ? `Transfer Bank (${bank.nama})` : METODE_BAYAR[data.bayar];
    return {
      nama: data.nama,
      tanggal: data.tanggal,
      jam: data.jam,
      catatan: data.catatan,
      // bacaItem() menjamin nama, qty, dan harga selalu valid sehingga pesan tidak memuat "undefined" / "Rp NaN".
      items: getItems().map((item) => {
        const i = bacaItem(item);
        return {
          nama: i.nama, qty: i.qty, kategori: namaKategori[i.kategori] || '-', diet: i.diet,
          satuan: i.satuan, spesifikasi: i.spesifikasi, ucapan: i.ucapan, subtotal: i.harga * i.qty,
        };
      }),
      antar: p.antar,
      cabang: p.cabang ? `${p.cabang.nama} (${p.cabang.alamat})` : '',
      alamat: data.alamat,
      patokan: data.patokan,
      mapsUrl: p.antar && state.gps ? linkGoogleMaps(state.gps.lat, state.gps.lng) : '',
      jarakLabel: p.lokasi.jarakLabel,
      ongkirStatus: p.lokasi.status,
      ongkir: p.lokasi.ongkir,
      maxRadiusKm: MAX_RADIUS_KM,
      metodeBayar: p.siap ? labelMetode : `${labelMetode} (menunggu ongkir)`,
      skema: labelSkema(p),
      subtotal: p.subtotal,
      grandTotal: p.grandTotal,
      bayarSekarang: p.tagihan ? p.tagihan.bayarSekarang : null,
      sisa: p.tagihan ? p.tagihan.sisa : null,
      cash: p.cash,
      sudahBayar,
    };
  }

  /* ---------- GPS ---------- */
  const setStatusGPS = (teks, jenis = 'info') => {
    const el = $('#gps-status');
    el.hidden = !teks;
    el.textContent = teks;
    el.className = `geo-status geo-status--${jenis}`;
  };

  $('#btn-gps').addEventListener('click', async (e) => {
    const tombol = e.currentTarget;
    tombol.disabled = true;
    setStatusGPS('Mendeteksi lokasi Anda…');
    try {
      const pos = await ambilLokasiGPS();
      state.gps = pos;
      // Cabang terdekat dipilih otomatis; pembeli tetap boleh menggantinya.
      isiOpsiCabang(pos);
      const terdekat = urutkanCabangTerdekat(daftarCabang, pos)[0];
      if (terdekat) form.cabang.value = terdekat.cabang.id;
      form.zona.value = '';
      perbarui();
      setStatusGPS(`Lokasi terdeteksi (akurasi ±${pos.akurasi} m). Mencari alamat…`);

      try {
        const alamat = await cariAlamatDariKoordinat(pos.lat, pos.lng);
        // Alamat yang sudah diketik pembeli tidak ditimpa; hanya kolom kosong / hasil otomatis sebelumnya.
        const boleh = !form.alamat.value.trim() || form.alamat.value === state.alamatOtomatis;
        if (alamat && boleh) {
          form.alamat.value = alamat;
          state.alamatOtomatis = alamat;
          setStatusGPS('Lokasi & alamat terisi otomatis. Periksa lagi, lalu lengkapi patokan / nomor rumah.', 'ok');
        } else if (alamat) {
          setStatusGPS('Lokasi terdeteksi. Alamat yang sudah Anda ketik tidak diganti.', 'ok');
        } else {
          setStatusGPS('Lokasi terdeteksi, tetapi alamat tidak ditemukan. Mohon ketik alamat lengkap.', 'warn');
        }
      } catch {
        setStatusGPS('Lokasi terdeteksi, tetapi alamat otomatis gagal dimuat. Mohon ketik alamat lengkap secara manual.', 'warn');
      }
    } catch (err) {
      setStatusGPS(err.message, 'warn');
    } finally {
      tombol.disabled = false;
      perbarui();
    }
  });

  $('#btn-reset-gps').addEventListener('click', () => {
    state.gps = null;
    isiOpsiCabang(null);
    setStatusGPS('');
    perbarui();
  });

  /* ---------- Event ---------- */
  subscribe(() => {
    $('#order-items').innerHTML = renderCartItems({ detail: true });
    $('#order-total').textContent = formatRupiah(getSubtotal());
    perbarui();
  });

  $('#order-tambah').addEventListener('click', () => {
    // addItem() membentuk item seragam yang sama dengan tombol "+ Keranjang" di Beranda & Katalog.
    addItem(daftarProduk.find((p) => String(p.id) === $('#order-produk').value), { buka: false });
  });

  // Diet & tulisan di kue per item disimpan ke keranjang tanpa menggambar ulang daftar.
  container.addEventListener('input', (e) => {
    const el = e.target.closest('[data-detail]');
    if (el) ubahDetail(el.dataset.id, el.dataset.detail, el.value);
  });

  container.addEventListener('click', (e) => {
    const nominal = e.target.closest('[data-salin-nominal]');
    if (nominal) salinTeks(nominal.dataset.nominal, 'Nominal disalin');
    const rek = e.target.closest('[data-salin-rekening]');
    if (rek) salinTeks(rek.dataset.salinRekening, 'Nomor rekening disalin');
  });

  form.addEventListener('change', (e) => {
    // Pilihan skema oleh pembeli diingat, agar kembali ke pilihan semula setelah keluar dari mode Cash.
    if (e.target.name === 'pembayaran') state.skema = e.target.value;
    if (e.target.name === 'bank') renderBankDetail();
    perbarui();
  });
  form.addEventListener('input', (e) => { if (['tanggal', 'jam'].includes(e.target.name)) perbarui(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    ['nama', 'alamat', 'patokan', 'catatan'].forEach((k) => { data[k] = (data[k] || '').trim(); });
    const p = hitungPesanan();
    const pesan = validasi(data, p);
    error.hidden = !pesan;
    error.textContent = pesan;
    if (!pesan) window.open(waLink(buatPesanPesanan(susunOrder(data, p))), '_blank', 'noopener');
  });

  // Gambar QRIS: bila berkas belum ada, tampilkan gambar contoh + peringatan.
  const gambarQris = $('#qris-img');
  const pakaiContoh = () => {
    if (gambarQris.dataset.contoh) return;
    gambarQris.dataset.contoh = '1';
    gambarQris.src = gambarQrisContoh();
    tampil('#qris-contoh', true);
  };
  gambarQris.addEventListener('error', pakaiContoh);
  if (gambarQris.complete && gambarQris.naturalWidth === 0 && gambarQris.getAttribute('src')) pakaiContoh();

  renderBankDetail();
  perbarui();
}
