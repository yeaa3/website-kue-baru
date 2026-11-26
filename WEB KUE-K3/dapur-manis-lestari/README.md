# Dapur Manis Lestari

Situs profil toko kue (HTML + CSS + JavaScript native, tanpa framework).
Struktur folder mengikuti `02-architecture.md`.

## Menjalankan
Data dimuat lewat `fetch()` dari `src/data/*.json`, jadi **wajib** memakai server lokal
(mis. ekstensi *Live Server* di VS Code) lalu buka `index.html` di root.

## Mengubah isi
- Produk & harga : `src/data/produk.json`
- Nomor WA, jam buka, **DP (%), pelunasan, rekening/e-wallet, media sosial** : `src/data/bisnis.json`
  (nomor rekening BCA/BRI/e-wallet di berkas ini adalah **data fiktif**, ganti dengan rekening asli sebelum tayang; Instagram resmi sudah `@dapurmanis_madiun`, URL Facebook & TikTok masih contoh)
- Cabang / testimoni / FAQ : `cabang.json`, `testimoni.json`, `faq.json`
  (**`lat` & `lng` tiap cabang di `cabang.json` masih perkiraan, wajib diganti** dengan titik toko sebenarnya)
- Foto produk : simpan di `src/assets/produk/` sesuai kolom `gambar` pada `produk.json`
  (jika foto belum ada, kartu otomatis menampilkan ikon pengganti).

## Foto produk yang perlu dilengkapi
Dua produk memakai foto lokal, simpan di `src/assets/produk/` dengan nama persis:
- `dessert-table-paket-a.jpg`
- `putri-salju-pandan-mede.jpg`

Selama foto belum ada, situs otomatis memakai ilustrasi `.svg` dengan nama yang sama
(sementara). Setelah foto dimasukkan, file `.svg` boleh dihapus.

## Tampilan: warna, font, foto hero
- **Palet warna**: semua di `src/styles/tokens.css` — latar halaman `#F8C4C4` (Soft Pastel Pink), kartu produk/kartu info/input form/QRIS `#FAF4E4` (Creamy Off-White), tombol utama + lingkaran nomor + badge `#EB6378` (hover `#D14B60`, teks putih), header/overlay hero/footer/judul & paragraf `#820527` (Deep Burgundy Maroon, teks di atasnya `#FAF4E4`). Jangan menulis kode warna langsung di komponen; pakai `var(--color-…)`.
- **Font**: judul = Playfair Display (cadangan Lora/Georgia); selain judul = **Bobaland**. Taruh `Bobaland.woff2` (dan/atau `Bobaland.ttf`) di `public/fonts/`. Selama belum ada, otomatis memakai Fredoka/Quicksand.
- **Foto hero HD**: edit `HERO_FOTO` di `src/components/hero-slider.js` (berkas di `src/assets/hero/` atau URL penuh, ≥ 1920 px). Bila kosong, hero memakai foto produk dalam resolusi tinggi.

## Halaman
Beranda `src/pages/index.html` · Produk `produk/index.html` (mendukung `?q=kata&kategori=id`) · Cara Pesan `cara-pesan.html` · FAQ `faq.html` · Cabang `cabang.html`.
Alamat halaman dikelola satu tempat di `src/utils/paths.js` (`ROUTES`).

## Checkout di website (lokasi, ongkir, DP/Lunas, QRIS)
Seluruh perhitungan terjadi di `cara-pesan.html`; WhatsApp hanya untuk konfirmasi akhir.

| Yang ingin diubah | Di mana |
|---|---|
| Radius maksimal (15 km), tarif dasar, jarak dasar, tarif per km, zona manual | bagian **PENGATURAN** di `src/utils/lokasi.js` |
| Koordinat toko (lat, lng) | `src/data/cabang.json` (Google Maps: klik kanan titik toko → klik angka koordinat) |
| Persentase DP, hari pelunasan, rekening bank | `src/data/bisnis.json` (`pembayaran`) |
| **Gambar QRIS** | simpan sebagai `src/assets/qris.png` (atau ubah `pembayaran.qris.gambar`). Sebelum ada, tampil gambar *contoh* bertanda "BUKAN QRIS ASLI" |
| Format pesan WhatsApp | `buatPesanPesanan()` di `src/utils/whatsapp.js` |

Catatan:
- Ongkir = `tarif dasar` untuk 0–3 km, lalu `+ Rp 3.000` per km berikutnya (dibulatkan ke atas), dari **jarak garis lurus (Haversine)**; jarak jalan sebenarnya biasanya lebih jauh.
- Jarak > 15 km: ongkir "Konfirmasi Admin", QRIS/Transfer dikunci, tombol berubah menjadi *Tanya Ongkir Luar Radius ke Admin*.
- Cash hanya untuk Ambil di Toko dan otomatis Lunas 100%.
- GPS (`navigator.geolocation`) hanya berfungsi di **HTTPS atau localhost**. Alamat otomatis memakai Nominatim OpenStreetMap (gratis, untuk pemakaian ringan).
- QRIS statis: pembeli memasukkan nominal sendiri, karena itu nominal ditampilkan besar + tombol Salin Nominal.
