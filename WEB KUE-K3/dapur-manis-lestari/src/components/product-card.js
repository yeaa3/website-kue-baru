import { resolveImage } from '../utils/paths.js';
import { escapeHTML, formatRupiah } from '../utils/format.js';
import { waLink } from '../utils/whatsapp.js';
import { addItem, itemValid } from './cart.js';

/**
 * Membuat HTML satu kartu produk. `emoji` dipakai bila foto belum tersedia.
 * Ukuran kotak foto diatur CSS (.product-card__media: aspect-ratio seragam + object-fit: cover),
 * jadi atribut width/height di <img> hanya untuk mencegah layout bergeser saat foto dimuat.
 */
export function renderProductCard(produk, emoji = '🧁') {
  const bisaDibeli = itemValid(produk); // nama ada & harga angka > 0; selain itu tampil "Hubungi Kami"
  const pesanWA = bisaDibeli
    ? `Halo Dapur Manis, saya ingin memesan ${produk.nama} (${formatRupiah(produk.harga)})`
    : `Halo Dapur Manis, saya ingin konsultasi ${produk.nama}`;

  return `
    <article class="product-card">
      <div class="product-card__media" data-emoji="${emoji}">
        <img src="${escapeHTML(resolveImage(produk.gambar))}" alt="${escapeHTML(produk.nama)}" width="600" height="600" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <span class="badge product-card__label">${escapeHTML(produk.label)}</span>
      </div>
      <div class="product-card__body">
        <h3 class="product-card__name">${escapeHTML(produk.nama)}</h3>
        <p class="product-card__desc">${escapeHTML(produk.deskripsi)}</p>
        <p class="product-card__price">
          ${bisaDibeli ? formatRupiah(produk.harga) : 'Hubungi Kami'}
          <span class="product-card__unit">${escapeHTML(produk.satuan)}</span>
        </p>
        <div class="product-card__actions">
          ${bisaDibeli ? `<button class="btn btn--primary btn--sm" type="button" data-add-cart="${produk.id}">+ Keranjang</button>` : '<span></span>'}
          <a class="btn btn--wa btn--sm" href="${waLink(pesanWA)}" target="_blank" rel="noopener noreferrer">Pesan</a>
        </div>
      </div>
    </article>`;
}

/**
 * Satu-satunya jalur tombol "+ Keranjang" (Beranda & Katalog): mencari produk berdasarkan id
 * lalu mengirimnya ke addItem(), yang membentuk item seragam (nama, harga, qty, spesifikasi, ucapan).
 * Dipasang sekali pada wadah; aman walau isi wadah digambar ulang.
 */
export function bindAddToCart(container, daftarProduk) {
  container.addEventListener('click', (e) => {
    const id = e.target.closest('[data-add-cart]')?.dataset.addCart;
    if (!id) return;
    addItem(daftarProduk.find((p) => String(p.id) === id));
  });
}

/**
 * Bila foto lokal (.jpg/.png/.webp) belum ada, coba berkas .svg dengan nama sama;
 * jika masih gagal, tampilkan ikon pengganti.
 */
export function applyImageFallback(container) {
  container.querySelectorAll('[data-emoji] > img').forEach((img) => {
    img.addEventListener('error', () => {
      const bisaCobaSvg = /\.(jpe?g|png|webp)(\?.*)?$/i.test(img.src);
      if (bisaCobaSvg && !img.dataset.triedSvg) {
        img.dataset.triedSvg = '1';
        img.addEventListener('error', () => tampilkanPengganti(img), { once: true });
        img.src = img.src.replace(/\.(jpe?g|png|webp)(\?.*)?$/i, '.svg');
        return;
      }
      tampilkanPengganti(img);
    }, { once: true });
  });
}

function tampilkanPengganti(img) {
  const placeholder = document.createElement('div');
  placeholder.className = 'product-card__placeholder';
  placeholder.textContent = img.parentElement.dataset.emoji;
  img.replaceWith(placeholder);
}
