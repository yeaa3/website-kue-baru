import { escapeHTML, formatRupiah } from '../utils/format.js';
import { PAGES_URL } from '../utils/paths.js';
import { showToast } from './toast.js';

const STORAGE_KEY = 'dapur_manis_cart_v1';

/** Pilihan diet per kue (diisi di formulir pemesanan, ikut dikirim ke WhatsApp). */
export const DIET_OPSI = ['Regular', 'Less sugar', 'Eggless', 'Nut-free'];

/* ---------- Normalisasi & validasi item ----------
   Bentuk item keranjang yang seragam (dari tombol mana pun):
   { id, nama, harga, qty, minQty, kategori, satuan, diet, spesifikasi, ucapan }
   Properti lama/berbeda (name, price) tetap dibaca lewat fallback, sehingga tidak pernah
   menghasilkan "undefined" atau "Rp NaN". Semua helper memakai `function` agar aman dipanggil
   saat modul pertama kali dimuat. */
const NAMA_BAWAAN = 'Produk Kue';

function namaDari(item) { return String(item?.nama || item?.name || '').trim(); }

function hargaDari(item) {
  const harga = Number(item?.harga ?? item?.price ?? 0);
  return Number.isFinite(harga) ? harga : 0;
}

function bulatPositif(nilai, bawaan) {
  const n = Math.floor(Number(nilai));
  return Number.isFinite(n) && n >= 1 ? n : bawaan;
}

function buatSlug(teks) { return teks.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk'; }

/** "Regular | Ø 18 cm" — ringkasan spesifikasi item (diet + ukuran/satuan). */
export function buatSpesifikasi(diet, satuan) {
  const ukuran = String(satuan || '').replace(/^\s*\/\s*/, '').trim();
  return [diet || DIET_OPSI[0], ukuran].filter(Boolean).join(' | ');
}

/** true bila item punya nama dan harga angka valid (> 0). Dipakai untuk menyaring data & produk yang bisa dipesan. */
export function itemValid(item) {
  return Boolean(item) && typeof item === 'object' && namaDari(item) !== '' && hargaDari(item) > 0;
}

/**
 * Membaca item apa pun (dari localStorage, katalog, atau halaman lain) menjadi bentuk seragam yang aman:
 * angka selalu angka, teks selalu teks. Tidak pernah melempar error dan tidak pernah menghasilkan NaN.
 */
export function bacaItem(item) {
  const nama = namaDari(item) || NAMA_BAWAAN;
  const harga = hargaDari(item);
  const minQty = bulatPositif(item?.minQty, 1);
  const qty = Math.max(minQty, bulatPositif(item?.qty, minQty));
  const diet = DIET_OPSI.includes(item?.diet) ? item.diet : DIET_OPSI[0];
  const satuan = String(item?.satuan ?? '');
  return {
    id: String(item?.id ?? '').trim() || buatSlug(nama),
    nama,
    harga,
    qty,
    minQty,
    kategori: String(item?.kategori ?? ''),
    satuan,
    diet,
    spesifikasi: buatSpesifikasi(diet, satuan),
    ucapan: String(item?.ucapan ?? '').slice(0, 60),
  };
}

/** Item keranjang baru dari produk katalog; null bila produk tidak valid (mis. harga "Hubungi Kami"). */
export function buatItemKeranjang(produk) {
  return itemValid(produk) ? bacaItem(produk) : null;
}

/** Membuang item tidak valid, merapikan sisanya, dan menggabungkan id kembar. */
function sanitasiDaftar(daftar) {
  const peta = new Map();
  daftar.filter(itemValid).map(bacaItem).forEach((item) => {
    const ada = peta.get(item.id);
    if (ada) ada.qty += item.qty;
    else peta.set(item.id, item);
  });
  return [...peta.values()];
}

/* ---------- State ---------- */
const listeners = new Set();
let items = bacaPenyimpanan();
let root;

function bacaPenyimpanan() {
  let mentah;
  try { mentah = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return []; }
  if (!Array.isArray(mentah)) return [];
  const bersih = sanitasiDaftar(mentah);
  tulis(bersih); // data lama yang rusak ikut dibersihkan dari penyimpanan
  return bersih;
}

function tulis(daftar = items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(daftar)); } catch { /* abaikan */ }
}

function simpan() {
  tulis();
  render();
}

export const getItems = () => items;
/** Subtotal produk (belum termasuk ongkir). Ongkir, DP/Lunas, dan Grand Total dihitung di order-form.js. */
export const getSubtotal = () => items.reduce((sum, item) => {
  const { harga, qty } = bacaItem(item);
  return sum + harga * qty;
}, 0);
export const getTotalHarga = getSubtotal; // nama lama, dipertahankan agar kode lain tidak rusak
const totalQty = () => items.reduce((sum, item) => sum + bacaItem(item).qty, 0);

/** Mendaftarkan fungsi yang dipanggil setiap isi keranjang berubah (juga dipanggil sekali di awal). */
export function subscribe(fn) { listeners.add(fn); fn(); }

/** Menambah produk ke keranjang. Mengembalikan true bila berhasil. Struktur item selalu seragam (lihat bacaItem). */
export function addItem(produk, { buka = true } = {}) {
  const baru = buatItemKeranjang(produk);
  if (!baru) { showToast('Produk ini belum bisa ditambahkan ke keranjang'); return false; }
  const ada = items.find((i) => i.id === baru.id);
  if (ada) ada.qty += 1;
  else items.push(baru);
  simpan();
  showToast(`${baru.nama} ditambahkan`);
  if (buka) openCart();
  return true;
}

export function ubahQty(id, selisih) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.qty += selisih;
  if (item.qty < item.minQty) items = items.filter((i) => i.id !== id);
  simpan();
}

/** Mengubah detail item (diet / ucapan) tanpa menggambar ulang, agar kolom teks tidak kehilangan fokus. */
export function ubahDetail(id, kolom, nilai) {
  const item = items.find((i) => i.id === id);
  if (!item || !['diet', 'ucapan'].includes(kolom)) return;
  if (kolom === 'diet') {
    item.diet = DIET_OPSI.includes(nilai) ? nilai : DIET_OPSI[0];
    item.spesifikasi = buatSpesifikasi(item.diet, item.satuan);
  } else {
    item.ucapan = String(nilai ?? '').slice(0, 60);
  }
  tulis();
}

export function clearCart() { items = []; simpan(); }

/**
 * HTML daftar item keranjang (dipakai drawer dan halaman formulir).
 * Dengan `{ detail: true }` tiap item juga memuat pilihan diet dan kolom tulisan di kue.
 */
export function renderCartItems({ detail = false } = {}) {
  if (!items.length) {
    return '<div class="cart__empty">🧁<p>Keranjang masih kosong.<br>Pilih kue favorit Anda dulu, ya.</p></div>';
  }
  return items.map((raw) => {
    const i = bacaItem(raw);
    const id = escapeHTML(i.id);
    return `
    <div class="cart-item${detail ? ' cart-item--detail' : ''}">
      <div>
        <div class="cart-item__name">${escapeHTML(i.nama)}</div>
        <div class="cart-item__price">${formatRupiah(i.harga)} × ${i.qty} = ${formatRupiah(i.harga * i.qty)}</div>
      </div>
      <div class="qty">
        <button type="button" data-qty="-1" data-id="${id}" aria-label="Kurangi">−</button>
        <span>${i.qty}</span>
        <button type="button" data-qty="1" data-id="${id}" aria-label="Tambah">+</button>
      </div>
      ${detail ? `
      <div class="cart-item__detail">
        <label class="field">Diet
          <select data-detail="diet" data-id="${id}">
            ${DIET_OPSI.map((d) => `<option${d === i.diet ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="field">Tulisan di kue (opsional)
          <input type="text" data-detail="ucapan" data-id="${id}" maxlength="60" value="${escapeHTML(i.ucapan)}" placeholder="Mis. Selamat Ulang Tahun Ayah">
        </label>
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ---------- Tampilan drawer ---------- */
function render() {
  document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = totalQty(); });
  if (root) {
    root.querySelector('[data-cart-items]').innerHTML = renderCartItems();
    root.querySelector('[data-cart-total]').textContent = formatRupiah(getSubtotal());
  }
  listeners.forEach((fn) => fn());
}

export const openCart = () => root?.classList.add('is-open');
export const closeCart = () => root?.classList.remove('is-open');

/* ---------- Inisialisasi ---------- */
export function initCart() {
  root = document.createElement('div');
  root.className = 'cart';
  root.innerHTML = `
    <div class="cart__backdrop" data-cart-close></div>
    <aside class="cart__panel" aria-label="Keranjang pesanan">
      <div class="cart__head">
        <h2>Keranjang Pesanan</h2>
        <button class="cart__close" type="button" data-cart-close aria-label="Tutup">✕</button>
      </div>
      <div class="cart__items" data-cart-items></div>
      <div class="cart__foot">
        <div class="cart__total"><span>Subtotal Produk</span><strong data-cart-total>Rp 0</strong></div>
        <p class="muted cart__note">Ongkir &amp; DP/Lunas dihitung otomatis di formulir pemesanan.</p>
        <a class="btn btn--wa btn--block" data-cart-checkout href="${PAGES_URL}cara-pesan.html#formulir-pesan">Lanjut ke Formulir Pemesanan</a>
      </div>
    </aside>`;
  document.body.append(root);

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]')) openCart();
    if (e.target.closest('[data-cart-close]')) closeCart();
    const checkout = e.target.closest('[data-cart-checkout]');
    if (checkout) {
      if (!items.length) { e.preventDefault(); showToast('Pilih produk terlebih dahulu'); } else closeCart();
    }
    const tombolQty = e.target.closest('[data-qty]');
    if (tombolQty) ubahQty(tombolQty.dataset.id, Number(tombolQty.dataset.qty));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

  render();
}
