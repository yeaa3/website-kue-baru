import { ASSETS_URL, pageUrl, resolveImage } from '../utils/paths.js';
import { escapeHTML, formatRupiah } from '../utils/format.js';
import { applyImageFallback } from './product-card.js';

const INTERVAL_MS = 5000;

/* =====================================================================
   FOTO BACKGROUND HERO (HD)
   Tujuh foto di bawah ditampilkan berurutan (1 → 7, lalu kembali ke 1).
   - src     : nama berkas di src/assets/hero/ (atau URL penuh 'https://…', disarankan lebar ≥ 1920 px, rasio 16:9).
   - alt     : deskripsi foto untuk pembaca layar.
   - caption : teks singkat pada label di pojok kanan atas (tautan ke katalog).
   Menambah/menghapus foto cukup dengan mengubah daftar ini; panah, dots, dan auto-slide mengikuti jumlahnya.
   Bila HERO_FOTO dikosongkan, slider memakai foto produk ulang tahun/wedding dari produk.json.
   Bila sebuah foto gagal dimuat, slide otomatis memakai gradasi maroon–rose + ikon kue.
   ===================================================================== */
const HERO_FOTO = [
  { src: 'hero-1.jpeg', alt: 'Cupcake krim vanila dengan rasberi dan daun mint', caption: 'Cupcake Krim Vanila & Rasberi' },
  { src: 'hero-2.jpeg', alt: 'Etalase toko kue penuh aneka cake dan cupcake', caption: 'Etalase Aneka Cake & Cupcake' },
  { src: 'hero-3.jpeg', alt: 'Close-up lapisan sponge cake stroberi dan krim', caption: 'Sponge Cake Stroberi & Krim' },
  { src: 'hero-4.jpeg', alt: 'Tangan menghias kue krim putih dan rasberi di atas cake stand', caption: 'Dihias Penuh Ketelitian' },
  { src: 'hero-5.jpeg', alt: 'Pastry chef wanita sedang mendekorasi kue di dapur', caption: 'Dibuat Langsung oleh Pastry Chef' },
  { src: 'hero-6.jpeg', alt: 'Ragam kue utuh: strawberry shortcake, cokelat, oreo, dan lemon di atas meja kayu', caption: 'Ragam Kue Pilihan' },
  { src: 'hero-7.jpeg', alt: 'Suasana interior kafe Dapur Manis Lestari', caption: 'Suasana Dapur Manis Lestari' },
];

const LEBAR_HD = 1920;
const LEBAR_HP = 1080;

/** Nama berkas HERO_FOTO → src/assets/hero/; URL penuh dipakai apa adanya. */
const urlFoto = (src) => (/^https?:\/\//.test(src) ? src : `${ASSETS_URL}hero/${src}`);

/** Meminta versi resolusi tinggi dari foto Google (…=w1920-rw); URL lain dipakai apa adanya. */
function sumberHD(url) {
  if (!/lh3\.googleusercontent\.com/.test(url)) return { src: url, srcset: '' };
  const dasar = url.replace(/=[wsh]\d.*$/, '');
  return {
    src: `${dasar}=w${LEBAR_HD}-rw`,
    srcset: `${dasar}=w${LEBAR_HP}-rw ${LEBAR_HP}w, ${dasar}=w${LEBAR_HD}-rw ${LEBAR_HD}w`,
  };
}
const SWIPE_MIN_PX = 50;      // geseran minimal agar dianggap pindah slide
const SWIPE_RATIO = 0.15;     // atau 15% lebar slider, mana yang lebih besar

/**
 * Slider lebar penuh (full-bleed), berputar tanpa ujung.
 * - Mobile: geser jari (swipe). Desktop: drag dengan mouse, tombol panah, atau tombol keyboard ← →.
 * - Otomatis berpindah; berhenti saat kursor/fokus berada di slider atau tab tidak aktif.
 * Setiap slide diposisikan relatif terhadap slide aktif (-1, 0, +1, …), jadi putaran
 * dari slide terakhir ke pertama tetap mulus tanpa menggandakan elemen.
 */
export function initHeroSlider(container, daftarProduk) {
  const dariProduk = daftarProduk
    .filter((p) => p.kategori === 'ulang-tahun' || p.id === 'wedding-cake-3-tingkat')
    .map((p) => ({ ...p, foto: resolveImage(p.gambar) }));
  // Foto khusus hero (HERO_FOTO) tampil apa adanya, berurutan; label menautkan ke katalog.
  // Tanpa HERO_FOTO: pakai foto produk (label menampilkan nama & harga, tautan mencari produk tsb).
  const daftar = HERO_FOTO.length
    ? HERO_FOTO.map((f) => ({ nama: f.alt, caption: f.caption || f.alt, foto: urlFoto(f.src), tautan: pageUrl('produk') }))
    : dariProduk.map((p) => ({
        ...p,
        caption: `${p.nama}${p.harga ? ` · ${formatRupiah(p.harga)}` : ''}`,
        tautan: pageUrl('produk', `?q=${encodeURIComponent(p.nama)}`),
      }));
  if (!container || !daftar.length) return;

  const total = daftar.length;
  const bisaGeser = total > 1;

  container.setAttribute('role', 'region');
  container.setAttribute('aria-roledescription', 'carousel');
  container.setAttribute('aria-label', 'Galeri kue Dapur Manis Lestari');
  container.tabIndex = 0;

  container.innerHTML = `
    <div class="hero-slider__track">
      ${daftar.map((p, i) => `
        <figure class="hero-slider__slide" role="group" aria-roledescription="slide" aria-label="${i + 1} dari ${total}: ${escapeHTML(p.nama)}">
          <div class="hero-slider__media" data-emoji="🎂">
            ${(() => { const hd = sumberHD(p.foto); return `<img src="${escapeHTML(hd.src)}"${hd.srcset ? ` srcset="${escapeHTML(hd.srcset)}" sizes="100vw"` : ''} alt="${escapeHTML(p.nama)}" draggable="false" referrerpolicy="no-referrer" decoding="async"${i === 0 ? ' fetchpriority="high"' : i < 2 ? '' : ' loading="lazy"'}>`; })()}
          </div>
        </figure>`).join('')}
    </div>
    <div class="hero-slider__shade"></div> <!-- overlay Deep Burgundy Maroon: gaya di components.css -->
    <a class="hero-slider__caption" data-caption href="#"></a>
    ${bisaGeser ? `
    <button class="hero-slider__nav hero-slider__nav--prev" type="button" data-arah="-1" aria-label="Kue sebelumnya">‹</button>
    <button class="hero-slider__nav hero-slider__nav--next" type="button" data-arah="1" aria-label="Kue berikutnya">›</button>
    <div class="hero-slider__dots">
      ${daftar.map((p, i) => `<button type="button" data-slide="${i}" aria-label="Tampilkan ${escapeHTML(p.nama)}"></button>`).join('')}
    </div>` : ''}`;
  applyImageFallback(container);

  const slides = [...container.querySelectorAll('.hero-slider__slide')];
  const dots = [...container.querySelectorAll('[data-slide]')];
  const caption = container.querySelector('[data-caption]');
  const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer;

  /** Menempatkan tiap slide di sebelah kiri/kanan slide aktif; `geser` = jarak drag (px). */
  function posisikan(geser = 0, animasi = true) {
    slides.forEach((el, i) => {
      let offset = (((i - index) % total) + total) % total;
      if (offset > total / 2) offset -= total;
      // Slide yang "melompat" dari ujung kiri ke ujung kanan tidak boleh dianimasikan.
      const melompat = el._offset !== undefined && Math.abs(offset - el._offset) > 1;
      el._offset = offset;
      el.style.transition = animasi && !melompat ? '' : 'none';
      el.style.transform = `translate3d(calc(${offset * 100}% + ${geser}px), 0, 0)`;
      el.classList.toggle('is-current', offset === 0);
      el.setAttribute('aria-hidden', offset === 0 ? 'false' : 'true');
    });
  }

  function tampilkan(i, animasi = true) {
    index = ((i % total) + total) % total;
    posisikan(0, animasi);
    dots.forEach((dot, n) => {
      dot.classList.toggle('is-active', n === index);
      dot.setAttribute('aria-current', n === index ? 'true' : 'false');
    });
    const slide = daftar[index];
    caption.textContent = slide.caption;
    caption.href = slide.tautan;
  }

  const berhenti = () => clearInterval(timer);
  const mulai = () => {
    if (kurangiGerak || !bisaGeser) return;
    berhenti();
    timer = setInterval(() => tampilkan(index + 1), INTERVAL_MS);
  };
  const pindah = (arah) => { tampilkan(index + arah); mulai(); };

  /* ---------- Tombol & dots ---------- */
  container.addEventListener('click', (e) => {
    const panah = e.target.closest('[data-arah]');
    if (panah) return pindah(Number(panah.dataset.arah));
    const dot = e.target.closest('[data-slide]');
    if (dot) { tampilkan(Number(dot.dataset.slide)); mulai(); }
  });

  /* ---------- Keyboard ---------- */
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); pindah(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); pindah(1); }
  });

  /* ---------- Swipe (sentuh) dan drag (mouse) ---------- */
  let sedangDrag = false;
  let awalX = 0;
  let jarak = 0;
  let lebar = 1;

  container.addEventListener('pointerdown', (e) => {
    if (!bisaGeser || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('a, button')) return; // biarkan tombol & tautan bekerja normal
    sedangDrag = true;
    awalX = e.clientX;
    jarak = 0;
    lebar = container.clientWidth || 1;
    berhenti();
    container.setPointerCapture?.(e.pointerId);
  });

  container.addEventListener('pointermove', (e) => {
    if (!sedangDrag) return;
    jarak = e.clientX - awalX;
    if (Math.abs(jarak) > 4) container.classList.add('is-dragging');
    posisikan(jarak, false);
  });

  const akhiriDrag = () => {
    if (!sedangDrag) return;
    sedangDrag = false;
    container.classList.remove('is-dragging');
    const batas = Math.max(SWIPE_MIN_PX, lebar * SWIPE_RATIO);
    if (jarak <= -batas) tampilkan(index + 1);
    else if (jarak >= batas) tampilkan(index - 1);
    else posisikan(); // kurang jauh: kembali ke slide semula
    mulai();
  };
  container.addEventListener('pointerup', akhiriDrag);
  container.addEventListener('pointercancel', akhiriDrag);
  container.addEventListener('dragstart', (e) => e.preventDefault());

  /* ---------- Jeda otomatis ---------- */
  container.addEventListener('mouseenter', berhenti);
  container.addEventListener('mouseleave', () => { if (!sedangDrag) mulai(); });
  container.addEventListener('focusin', berhenti);
  container.addEventListener('focusout', mulai);
  document.addEventListener('visibilitychange', () => (document.hidden ? berhenti() : mulai()));

  tampilkan(0, false); // posisi awal tanpa animasi agar tidak ada "kedipan"
  mulai();
}
