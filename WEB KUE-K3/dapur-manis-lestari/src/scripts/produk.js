import { initLayout } from './layout.js';
import { loadData } from '../utils/data.js';
import { escapeHTML } from '../utils/format.js';
import { cariProduk } from '../utils/search.js';
import { renderProductCard, applyImageFallback, bindAddToCart } from '../components/product-card.js';

const $ = (selector) => document.querySelector(selector);

// Kata kunci (?q=) dan kategori (?kategori=) bisa datang dari pencarian di Beranda.
const params = new URLSearchParams(location.search);
const state = {
  kategori: params.get('kategori') || 'all',
  kata: (params.get('q') || '').trim(),
  urutan: 'default',
};

const pengurut = {
  default: () => 0, // urutan asli (atau urutan relevansi saat ada kata kunci)
  'harga-rendah': (a, b) => (a.harga ?? Infinity) - (b.harga ?? Infinity),
  'harga-tinggi': (a, b) => (b.harga ?? -1) - (a.harga ?? -1),
  nama: (a, b) => a.nama.localeCompare(b.nama, 'id'),
};

function renderPills(kategori, produk) {
  const semua = [{ id: 'all', nama: 'Semua', jumlah: produk.length },
    ...kategori.map((k) => ({ ...k, jumlah: produk.filter((p) => p.kategori === k.id).length }))];
  $('#kategori-pills').innerHTML = semua.map((k) =>
    `<button class="pill ${k.id === state.kategori ? 'is-active' : ''}" type="button" data-kategori="${k.id}">${escapeHTML(k.nama)} (${k.jumlah})</button>`).join('');
}

/** Menjaga alamat halaman tetap mencerminkan filter, sehingga bisa dibagikan / di-refresh. */
function sinkronkanUrl() {
  const url = new URL(location.href);
  state.kata ? url.searchParams.set('q', state.kata) : url.searchParams.delete('q');
  state.kategori !== 'all' ? url.searchParams.set('kategori', state.kategori) : url.searchParams.delete('kategori');
  history.replaceState(null, '', url);
}

async function init() {
  const [, { kategori, produk }] = await Promise.all([initLayout('produk'), loadData('produk')]);
  const emojiMap = Object.fromEntries(kategori.map((k) => [k.id, k.emoji]));
  const namaKategori = Object.fromEntries(kategori.map((k) => [k.id, k.nama]));

  function render() {
    const hasil = cariProduk(produk.filter((p) => state.kategori === 'all' || p.kategori === state.kategori), state.kata, namaKategori)
      .sort(pengurut[state.urutan]);
    $('#hasil-jumlah').textContent = state.kata
      ? `Menampilkan ${hasil.length} produk untuk “${state.kata}”`
      : `Menampilkan ${hasil.length} produk`;
    $('#produk-list').innerHTML = hasil.map((p) => renderProductCard(p, emojiMap[p.kategori])).join('');
    $('#produk-kosong').hidden = hasil.length > 0;
    applyImageFallback($('#produk-list'));
    renderPills(kategori, produk);
    sinkronkanUrl();
  }

  $('#cari-produk').value = state.kata;
  $('#kategori-pills').addEventListener('click', (e) => {
    const tombol = e.target.closest('[data-kategori]');
    if (!tombol) return;
    state.kategori = tombol.dataset.kategori;
    render();
  });
  $('#cari-produk').addEventListener('input', (e) => { state.kata = e.target.value.trim(); render(); });
  $('#urutkan-produk').addEventListener('change', (e) => { state.urutan = e.target.value; render(); });
  bindAddToCart($('#produk-list'), produk);

  render();
}

init().catch((err) => console.error(err));
