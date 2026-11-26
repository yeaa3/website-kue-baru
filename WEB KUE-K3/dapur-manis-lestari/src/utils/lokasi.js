/* =====================================================================
   Lokasi, jarak, radius & ongkos kirim (logika murni, tanpa DOM).
   Semua angka yang perlu diubah pemilik toko ada di bagian PENGATURAN.
   ===================================================================== */

/* ---------------------------------------------------------------------
   PENGATURAN ONGKIR & RADIUS  (ubah angka di sini)
   ---------------------------------------------------------------------
   Rumus: jarak ≤ JARAK_DASAR_KM            → TARIF_DASAR
          jarak > JARAK_DASAR_KM            → TARIF_DASAR + (km di atas JARAK_DASAR_KM, dibulatkan ke atas) × TARIF_PER_KM
   Contoh dengan nilai bawaan:
          2,5 km → Rp 10.000 | 3,1 km → Rp 13.000 | 6 km → Rp 19.000 | 15 km → Rp 46.000
   --------------------------------------------------------------------- */
export const MAX_RADIUS_KM = 15;     // batas pengiriman reguler; lebih jauh → "Konfirmasi Admin"
export const TARIF_DASAR = 10000;    // tarif untuk jarak 0 – JARAK_DASAR_KM (Rp)
export const JARAK_DASAR_KM = 3;     // jarak yang sudah termasuk tarif dasar (km)
export const TARIF_PER_KM = 3000;    // tambahan per km berikutnya (Rp)

/**
 * Zona jarak manual: dipakai bila pembeli mengetik alamat tanpa mengaktifkan GPS.
 * Ongkir zona dihitung dari BATAS ATAS zona (estimasi aman). Tambah/ubah zona di sini;
 * zona terakhir ("luar") otomatis dianggap di luar radius.
 */
export const ZONA_MANUAL = [
  { id: 'z1', label: '0 – 3 km', maksKm: 3 },
  { id: 'z2', label: '3 – 6 km', maksKm: 6 },
  { id: 'z3', label: '6 – 10 km', maksKm: 10 },
  { id: 'z4', label: `10 – ${MAX_RADIUS_KM} km`, maksKm: MAX_RADIUS_KM },
  { id: 'luar', label: `Lebih dari ${MAX_RADIUS_KM} km`, luar: true },
];

/* ---------------------------------------------------------------------
   JARAK (Haversine)
   ---------------------------------------------------------------------
   KOORDINAT TOKO: atur di src/data/cabang.json, kolom "lat" dan "lng" tiap cabang.
   Cara mengambilnya: buka Google Maps → klik kanan pada titik toko → klik angka
   koordinat paling atas (mis. -7.629, 111.523) → yang pertama LAT, yang kedua LNG.
   --------------------------------------------------------------------- */
const RADIUS_BUMI_KM = 6371;
const keRadian = (derajat) => (derajat * Math.PI) / 180;

/** Cabang dianggap punya koordinat bila lat & lng berupa angka. */
export const adaKoordinat = (titik) => Boolean(titik) && Number.isFinite(titik.lat) && Number.isFinite(titik.lng);

/**
 * Jarak garis lurus (km) antara dua titik { lat, lng } dengan rumus Haversine.
 * Hasil dibulatkan 1 desimal (100 m) agar angka di layar, pesan WhatsApp, dan
 * pengecekan radius selalu sama.
 */
export function hitungJarakKm(a, b) {
  const dLat = keRadian(b.lat - a.lat);
  const dLng = keRadian(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(keRadian(a.lat)) * Math.cos(keRadian(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * RADIUS_BUMI_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(km * 10) / 10;
}

/** Semua cabang ber-koordinat beserta jaraknya ke `titik`, diurutkan dari yang terdekat. */
export function urutkanCabangTerdekat(daftarCabang, titik) {
  return daftarCabang
    .filter(adaKoordinat)
    .map((cabang) => ({ cabang, jarak: hitungJarakKm(cabang, titik) }))
    .sort((x, y) => x.jarak - y.jarak);
}

/** Ongkir (Rp) untuk jarak tertentu, sesuai PENGATURAN di atas. */
export function hitungOngkir(jarakKm) {
  // toFixed menghindari selisih pecahan desimal (mis. 4,3 - 3 = 1,2999…) sebelum dibulatkan ke atas.
  const kmTambahan = Math.max(0, Math.ceil(Number((jarakKm - JARAK_DASAR_KM).toFixed(6))));
  return TARIF_DASAR + kmTambahan * TARIF_PER_KM;
}

export const diLuarRadius = (jarakKm) => jarakKm > MAX_RADIUS_KM;

/** Tautan titik koordinat di Google Maps (untuk dikirim ke admin). */
export const linkGoogleMaps = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

/* ---------------------------------------------------------------------
   GPS & ALAMAT OTOMATIS
   --------------------------------------------------------------------- */
const PESAN_GPS = {
  1: 'Izin lokasi ditolak. Aktifkan izin lokasi di browser, atau ketik alamat dan pilih estimasi jarak.',
  2: 'Lokasi tidak dapat ditentukan. Nyalakan GPS/layanan lokasi, atau ketik alamat dan pilih estimasi jarak.',
  3: 'Pencarian lokasi terlalu lama. Coba lagi, atau ketik alamat dan pilih estimasi jarak.',
};

/** Koordinat pembeli lewat HTML5 Geolocation. Butuh HTTPS atau localhost. */
export function ambilLokasiGPS() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Browser Anda tidak mendukung deteksi lokasi. Silakan ketik alamat dan pilih estimasi jarak.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, akurasi: Math.round(coords.accuracy) }),
      (err) => reject(new Error(PESAN_GPS[err.code] || 'Gagal mengambil lokasi.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/**
 * Reverse geocoding gratis lewat Nominatim (OpenStreetMap): koordinat → alamat teks.
 * Catatan kebijakan Nominatim: pemakaian ringan saja (maks. 1 permintaan/detik) dan tanpa
 * pencarian massal. Untuk lalu lintas besar, ganti dengan layanan geocoding berbayar.
 */
export async function cariAlamatDariKoordinat(lat, lng) {
  const kontrol = new AbortController();
  const batas = setTimeout(() => kontrol.abort(), 8000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=id&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: kontrol.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    const a = data.address || {};
    const bagian = [
      [a.road, a.house_number].filter(Boolean).join(' '),
      a.neighbourhood || a.hamlet,
      a.village || a.suburb,
      a.city_district || a.municipality,
      a.city || a.town || a.county,
      a.state,
      a.postcode,
    ].filter(Boolean);
    const unik = bagian.filter((b, i) => bagian.indexOf(b) === i);
    return unik.length ? unik.join(', ') : (data.display_name || '');
  } finally {
    clearTimeout(batas);
  }
}
