// Pencarian produk yang dipakai bersama oleh Beranda (saran langsung) dan halaman Produk.

/** Huruf kecil + buang tanda aksen, agar "Pâtisserie" cocok dengan "patisserie". */
export const normalisasi = (teks) =>
  String(teks ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Mencari produk. Setiap kata kunci harus ditemukan (nama, deskripsi, label, kategori, satuan).
 * Hasil diurutkan berdasarkan relevansi: kecocokan di awal nama paling atas.
 * @param {object[]} daftar         produk dari produk.json
 * @param {string}   kata           kata kunci dari pengguna
 * @param {Record<string,string>} namaKategori  peta id kategori -> nama kategori
 */
export function cariProduk(daftar, kata, namaKategori = {}) {
  const token = normalisasi(kata).split(/\s+/).filter(Boolean);
  if (!token.length) return [...daftar];

  return daftar
    .map((produk) => {
      const nama = normalisasi(produk.nama);
      const lain = normalisasi(`${produk.deskripsi} ${produk.label} ${namaKategori[produk.kategori] ?? ''} ${produk.satuan}`);
      let skor = 0;
      for (const t of token) {
        if (nama.startsWith(t)) skor += 4;
        else if (nama.includes(` ${t}`)) skor += 3;
        else if (nama.includes(t)) skor += 2;
        else if (lain.includes(t)) skor += 1;
        else return null; // satu kata saja tidak cocok -> produk dibuang
      }
      return { produk, skor };
    })
    .filter(Boolean)
    .sort((a, b) => b.skor - a.skor)
    .map((hasil) => hasil.produk);
}
