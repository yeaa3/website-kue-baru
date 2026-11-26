import { initLayout } from './layout.js';
import { loadData } from '../utils/data.js';
import { escapeHTML, formatNomorRekening, formatRupiah } from '../utils/format.js';
import { JARAK_DASAR_KM, MAX_RADIUS_KM, TARIF_DASAR, TARIF_PER_KM, hitungOngkir } from '../utils/lokasi.js';
import { waLink } from '../utils/whatsapp.js';
import { renderOrderSection, hitungTagihan } from '../components/order-form.js';
import { showToast } from '../components/toast.js';

const $ = (selector) => document.querySelector(selector);

/** Mengisi elemen [data-bisnis="pembayaran.dpPersen"] dst. agar angka di teks selalu sama dengan bisnis.json. */
function isiDataBisnis(bisnis) {
  document.querySelectorAll('[data-bisnis]').forEach((el) => {
    const nilai = el.dataset.bisnis.split('.').reduce((acc, kunci) => acc?.[kunci], bisnis);
    if (nilai !== undefined && nilai !== null) el.textContent = nilai;
  });
}

/** Mengisi [data-pengiriman="radius|tarifDasar|jarakDasar|tarifPerKm|contohJauh"] dari konstanta di lokasi.js. */
function isiDataPengiriman() {
  const nilai = {
    radius: `${MAX_RADIUS_KM}`,
    tarifDasar: formatRupiah(TARIF_DASAR),
    jarakDasar: `${JARAK_DASAR_KM}`,
    tarifPerKm: formatRupiah(TARIF_PER_KM),
    contohJauh: formatRupiah(hitungOngkir(MAX_RADIUS_KM)),
  };
  document.querySelectorAll('[data-pengiriman]').forEach((el) => {
    if (nilai[el.dataset.pengiriman] !== undefined) el.textContent = nilai[el.dataset.pengiriman];
  });
}

const IKON_METODE = { bank: '🏦', ewallet: '📱', qris: '🔳', tunai: '💵' };

const kartuMetode = (m) => `
  <article class="card pay-method">
    <div class="pay-method__icon" aria-hidden="true">${IKON_METODE[m.jenis] || '💳'}</div>
    <div class="pay-method__body">
      <h4>${escapeHTML(m.nama)}</h4>
      ${m.nomor ? `
        <p class="pay-method__number" aria-label="Nomor ${escapeHTML(m.nomor)}">${escapeHTML(formatNomorRekening(m.nomor))}</p>
        <p class="muted">a.n. ${escapeHTML(m.atasNama || '')}</p>
        <button class="btn btn--soft btn--sm" type="button" data-salin="${escapeHTML(String(m.nomor).replace(/\D/g, ''))}">Salin nomor</button>`
        : `<p class="muted">${escapeHTML(m.keterangan || '')}</p>`}
    </div>
  </article>`;

/** Skema DP, daftar rekening/e-wallet, dan instruksi konfirmasi: semuanya dari bisnis.json. */
function renderPembayaran(container, { pembayaran: bayar }) {
  const contoh = hitungTagihan(400000, 'dp', bayar.dpPersen);

  container.innerHTML = `
    <div class="dp-flow">
      <article class="step-card dp-step">
        <span class="dp-step__no" aria-hidden="true">1</span>
        <div><h3>DP minimal ${bayar.dpPersen}%</h3><p class="muted">Dibayar maksimal ${escapeHTML(bayar.batasBayarDP)} untuk mengunci slot produksi.</p></div>
      </article>
      <article class="step-card dp-step">
        <span class="dp-step__no" aria-hidden="true">2</span>
        <div><h3>Pelunasan ${escapeHTML(bayar.pelunasanHari)}</h3><p class="muted">Sisa tagihan dilunasi paling lambat ${escapeHTML(bayar.pelunasanHari)} sebelum kue diambil atau dikirim.</p></div>
      </article>
      <article class="step-card dp-step">
        <span class="dp-step__no" aria-hidden="true">★</span>
        <div><h3>Atau bayar lunas</h3><p class="muted">Boleh langsung membayar penuh di awal, cocok untuk pesanan mendadak.</p></div>
      </article>
    </div>
    <p class="card dp-example"><strong>Contoh:</strong> pesanan ${formatRupiah(400000)} → DP ${bayar.dpPersen}% sebesar <strong>${formatRupiah(contoh.bayarSekarang)}</strong>,
      sisa <strong>${formatRupiah(contoh.sisa)}</strong> dilunasi paling lambat ${escapeHTML(bayar.pelunasanHari)}.</p>

    <h3 class="pay-subtitle">Rekening, E-Wallet &amp; Metode Lain</h3>
    <div class="pay-grid">${bayar.metode.map(kartuMetode).join('')}</div>

    <div class="card stack pay-confirm">
      <h3>Konfirmasi Bukti Pembayaran</h3>
      <ol class="steps">
        ${bayar.konfirmasi.map((langkah) => `<li><div><p>${escapeHTML(langkah)}</p></div></li>`).join('')}
      </ol>
      <a class="btn btn--wa" href="${waLink('Halo Dapur Manis Lestari, saya ingin mengonfirmasi pembayaran.\n\nNama pemesan: \nTanggal acara: \nNominal: \n\n(Bukti transfer terlampir)')}" target="_blank" rel="noopener noreferrer">Kirim Bukti Transfer via WhatsApp</a>
    </div>`;

  container.addEventListener('click', async (e) => {
    const tombol = e.target.closest('[data-salin]');
    if (!tombol) return;
    try {
      await navigator.clipboard.writeText(tombol.dataset.salin);
      showToast('Nomor rekening disalin');
    } catch {
      showToast('Gagal menyalin, salin manual ya');
    }
  });
}

async function init() {
  const [bisnis, katalog, cabang] = await Promise.all([
    initLayout('cara-pesan'),
    loadData('produk'),
    loadData('cabang').catch(() => []), // tanpa data cabang, formulir tetap jalan dengan estimasi zona
  ]);
  isiDataBisnis(bisnis);
  isiDataPengiriman();
  renderPembayaran($('#pembayaran-section'), bisnis);
  renderOrderSection($('#order-section'), katalog.produk, bisnis.pembayaran, katalog.kategori, cabang);
}

init().catch((err) => console.error(err));
