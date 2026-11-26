// Lokasi folder dihitung dari berkas ini, sehingga aman dipakai dari halaman mana pun.
export const PAGES_URL = new URL('../pages/', import.meta.url).href;
export const DATA_URL = new URL('../data/', import.meta.url).href;
export const ASSETS_URL = new URL('../assets/', import.meta.url).href;

/** Satu-satunya tempat yang mendefinisikan alamat halaman. Tambah halaman baru cukup di sini. */
export const ROUTES = {
  beranda: 'index.html',
  produk: 'produk/index.html',
  'cara-pesan': 'cara-pesan.html',
  faq: 'faq.html',
  cabang: 'cabang.html',
};

/** URL absolut sebuah halaman, mis. pageUrl('produk', '?q=nastar'). */
export const pageUrl = (key, suffix = '') => `${PAGES_URL}${ROUTES[key]}${suffix}`;

/** Gambar boleh berupa URL penuh (https://…) atau nama berkas di src/assets/produk/. */
export const resolveImage = (src) => (/^https?:\/\//.test(src) ? src : `${ASSETS_URL}produk/${src}`);
