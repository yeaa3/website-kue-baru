import { initLayout } from './layout.js';
import { loadData } from '../utils/data.js';
import { pageUrl, resolveImage } from '../utils/paths.js';
import { escapeHTML, formatRupiah } from '../utils/format.js';
import { cariProduk } from '../utils/search.js';
import { renderProductCard, applyImageFallback, bindAddToCart } from '../components/product-card.js';
import { initHeroSlider } from '../components/hero-slider.js';

const $ = (selector) => document.querySelector(selector);
const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =====================================================================
   Kategori & produk terlaris (preview katalog)
   ===================================================================== */
function renderKategori(kategori) {
  const container = $('#kategori-list');
  container.innerHTML = kategori.map((k) => `
    <a class="category-card" href="${pageUrl('produk', `?kategori=${k.id}`)}">
      <div class="category-card__media" data-emoji="${k.emoji}">
        <img src="${escapeHTML(resolveImage(k.gambar))}" alt="${escapeHTML(k.nama)}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="category-card__body">
        <strong>${escapeHTML(k.nama)}</strong>
        <span>${escapeHTML(k.keterangan)}</span>
      </div>
    </a>`).join('');
  applyImageFallback(container);
}

function renderTerlaris({ kategori, produk }) {
  const emojiMap = Object.fromEntries(kategori.map((k) => [k.id, k.emoji]));
  const container = $('#terlaris-list');
  container.innerHTML = produk.filter((p) => p.unggulan).slice(0, 6)
    .map((p) => renderProductCard(p, emojiMap[p.kategori])).join('');
  applyImageFallback(container);
  bindAddToCart(container, produk);
}

/* =====================================================================
   Pencarian kue: saran langsung saat mengetik, Enter/tombol Cari -> halaman Produk
   ===================================================================== */
const KATA_POPULER = ['Nastar', 'Red Velvet', 'Wedding Cake', 'Brownies', 'Hampers Lebaran'];
const MAKS_SARAN = 5;

const urlPencarian = (kata) => pageUrl('produk', kata ? `?q=${encodeURIComponent(kata)}` : '');

function initPencarian({ kategori, produk }) {
  const form = $('#search-form');
  const input = $('#search-input');
  const daftar = $('#search-suggest');
  const namaKategori = Object.fromEntries(kategori.map((k) => [k.id, k.nama]));
  const emojiKategori = Object.fromEntries(kategori.map((k) => [k.id, k.emoji]));
  let aktif = -1;

  // Jalan pintas: kategori + kata kunci populer
  $('#search-chips').innerHTML = [
    ...kategori.map((k) => `<a class="pill" href="${pageUrl('produk', `?kategori=${k.id}`)}">${k.emoji} ${escapeHTML(k.nama)}</a>`),
    ...KATA_POPULER.map((kata) => `<a class="pill" href="${urlPencarian(kata)}">${escapeHTML(kata)}</a>`),
  ].join('');

  const opsi = () => [...daftar.querySelectorAll('[role="option"]')];
  const tutup = () => {
    daftar.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    aktif = -1;
  };
  const tandai = (n) => {
    const semua = opsi();
    if (!semua.length) return;
    aktif = (n + semua.length) % semua.length;
    semua.forEach((el, i) => el.setAttribute('aria-selected', String(i === aktif)));
    input.setAttribute('aria-activedescendant', semua[aktif].id);
    semua[aktif].scrollIntoView({ block: 'nearest' });
  };

  function tampilkanSaran() {
    const kata = input.value.trim();
    if (kata.length < 2) return tutup();
    const hasil = cariProduk(produk, kata, namaKategori);

    daftar.innerHTML = hasil.length
      ? hasil.slice(0, MAKS_SARAN).map((p, i) => `
          <li role="presentation"><a role="option" id="saran-${i}" aria-selected="false" href="${urlPencarian(p.nama)}">
            <span class="search-suggest__emoji" aria-hidden="true">${emojiKategori[p.kategori] || '🧁'}</span>
            <span class="search-suggest__name">${escapeHTML(p.nama)}</span>
            <span class="search-suggest__price">${p.harga !== null ? formatRupiah(p.harga) : 'Hubungi kami'}</span>
          </a></li>`).join('') + `
          <li role="presentation"><a role="option" id="saran-semua" aria-selected="false" class="search-suggest__all" href="${urlPencarian(kata)}">
            Lihat semua ${hasil.length} hasil untuk “${escapeHTML(kata)}” →
          </a></li>`
      : `<li class="search-suggest__empty" role="presentation">Belum ada kue “${escapeHTML(kata)}”. Tekan Cari untuk melihat katalog atau tanya kami via WhatsApp.</li>`;

    daftar.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    aktif = -1;
  }

  input.addEventListener('input', tampilkanSaran);
  input.addEventListener('focus', tampilkanSaran);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return tutup();
    if (daftar.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); tandai(aktif + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); tandai(aktif - 1); }
    if (e.key === 'Enter' && aktif >= 0) { e.preventDefault(); opsi()[aktif].click(); }
  });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) tutup(); });

  // Enter / tombol "Cari": buka halaman Produk dengan kata kunci sudah terisi.
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    location.href = urlPencarian(input.value.trim());
  });
}

/* =====================================================================
   Testimoni: kolom yang bergerak vertikal terus-menerus.
   Kolom ganjil naik, kolom genap turun; berhenti saat kursor di atasnya.
   ===================================================================== */
const KECEPATAN_PX_DETIK = 28;

const bintang = (n = 5) => '★'.repeat(n) + '☆'.repeat(5 - n);

const kartuTestimoni = (t) => `
  <figure class="card testimonial">
    <div class="testimonial__stars" role="img" aria-label="Rating ${t.rating ?? 5} dari 5">${bintang(t.rating ?? 5)}</div>
    <blockquote><p>“${escapeHTML(t.pesan)}”</p></blockquote>
    <figcaption class="testimonial__who">
      <span class="testimonial__avatar" aria-hidden="true">${escapeHTML(t.nama.replace(/^(dr\.|bu|ibu|pak)\s+/i, '').charAt(0).toUpperCase())}</span>
      <span><strong>${escapeHTML(t.nama)}</strong><small>${escapeHTML(t.lokasi)}</small></span>
    </figcaption>
  </figure>`;

function initTestimoni(daftar) {
  const root = $('#testimoni-marquee');
  const tombol = $('#testimoni-toggle');
  const layarLebar = window.matchMedia('(min-width: 900px)');
  let jumlahKolom = 0;

  /** Menyusun kolom (2 di ponsel/tablet, 3 di desktop). Testimoni dibagi bergantian ke tiap kolom. */
  function susun() {
    jumlahKolom = Math.min(layarLebar.matches ? 3 : 2, daftar.length);
    const kolom = Array.from({ length: jumlahKolom }, () => []);
    daftar.forEach((t, i) => kolom[i % jumlahKolom].push(t));

    root.innerHTML = kolom.map((items, i) => `
      <div class="marquee__col${i % 2 ? ' marquee__col--down' : ''}">
        <div class="marquee__track"><div class="marquee__set">${items.map(kartuTestimoni).join('')}</div></div>
      </div>`).join('');
    ukur();
  }

  /** Mengukur tinggi satu set kartu lalu menggandakannya secukupnya agar putaran tidak terputus. */
  function ukur() {
    if (kurangiGerak) return; // tanpa animasi: cukup satu set, bisa di-scroll manual
    const tinggiWadah = root.clientHeight;
    root.querySelectorAll('.marquee__track').forEach((track) => {
      const set = track.firstElementChild;
      const geser = set.getBoundingClientRect().height;
      if (!geser) return;
      const salinan = Math.ceil(tinggiWadah / geser) + 1;
      while (track.children.length < salinan) {
        const dup = set.cloneNode(true);
        dup.setAttribute('aria-hidden', 'true'); // salinan tidak dibacakan ulang oleh screen reader
        track.append(dup);
      }
      track.style.setProperty('--shift', `${geser}px`);
      track.style.setProperty('--duration', `${geser / KECEPATAN_PX_DETIK}s`);
    });
  }

  susun();

  // Ukuran teks berubah saat font web selesai dimuat atau layar diubah ukurannya.
  document.fonts?.ready.then(ukur);
  let frame;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const kolomBaru = Math.min(layarLebar.matches ? 3 : 2, daftar.length);
      if (kolomBaru !== jumlahKolom) susun(); else ukur();
    });
  }).observe(root);

  // Tombol jeda/putar (agar pengguna bisa menghentikan gerakan, termasuk di layar sentuh).
  tombol.hidden = kurangiGerak;
  tombol.addEventListener('click', () => {
    const jeda = root.classList.toggle('is-paused');
    tombol.setAttribute('aria-pressed', String(jeda));
    tombol.textContent = jeda ? '▶ Putar' : '⏸ Jeda';
  });
}

/* =====================================================================
   Inisialisasi
   ===================================================================== */
async function init() {
  const [, katalog, testimoni] = await Promise.all([
    initLayout('beranda'), loadData('produk'), loadData('testimoni'),
  ]);
  // Hero slider (7 foto di src/assets/hero/) dijalankan lebih dulu & diisolasi:
  // jika ada galat di slider, bagian beranda lain (pencarian, kategori, terlaris, testimoni) tetap tampil.
  try {
    initHeroSlider($('#hero-slider'), katalog.produk);
  } catch (err) {
    console.error('Hero slider gagal dijalankan:', err);
  }
  initPencarian(katalog);
  renderKategori(katalog.kategori);
  renderTerlaris(katalog);
  initTestimoni(testimoni);
}

init().catch((err) => console.error(err));
