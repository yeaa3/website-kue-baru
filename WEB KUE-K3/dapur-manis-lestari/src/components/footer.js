import { escapeHTML } from '../utils/format.js';
import { pageUrl } from '../utils/paths.js';
import { waLink } from '../utils/whatsapp.js';
import { NAV_ITEMS } from './header.js';

/** Ikon media sosial (SVG garis, mengikuti warna teks). Tambah jenis baru di sini. */
const IKON_SOSMED = {
  instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
};

const mapsUrl = (alamat) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamat)}`;

/**
 * Footer lengkap untuk semua halaman.
 * @param {object}   bisnis  isi bisnis.json
 * @param {object[]} cabang  isi cabang.json (item pertama dianggap cabang utama)
 */
export function renderFooter(bisnis, cabang = []) {
  const utama = cabang[0];
  const lainnya = Math.max(cabang.length - 1, 0);
  const telepon = `+${bisnis.whatsapp}`;

  const daftarSosmed = bisnis.sosmed || [];
  const instagram = daftarSosmed.find((s) => s.ikon === 'instagram');
  const handleIG = instagram ? (instagram.handle || '@dapurmanis_madiun') : '';

  // Instagram tampil sebagai tombol besar dengan handle; media sosial lain tetap sebagai ikon.
  const sosmed = daftarSosmed.filter((s) => s !== instagram).map((s) => `
    <li><a class="social-link" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(s.nama)}" title="${escapeHTML(s.nama)}">
      ${IKON_SOSMED[s.ikon] || escapeHTML(s.nama.charAt(0))}
    </a></li>`).join('');

  return `
    <div class="container">
      <div class="site-footer__grid">
        <section class="site-footer__col site-footer__col--brand" aria-label="Profil">
          <a class="brand" href="${pageUrl('beranda')}"><span class="brand__mark">🧁</span><span>${escapeHTML(bisnis.nama)}</span></a>
          <p class="site-footer__tagline">${escapeHTML(bisnis.tagline)}</p>
          <p>${escapeHTML(bisnis.deskripsi || '')}</p>
          ${instagram ? `
          <a class="footer-ig" href="${escapeHTML(instagram.url)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram ${escapeHTML(handleIG)}">
            <span class="footer-ig__icon">${IKON_SOSMED.instagram}</span><span>${escapeHTML(handleIG)}</span>
          </a>` : ''}
          ${sosmed ? `<ul class="social-list" aria-label="Media sosial lainnya">${sosmed}</ul>` : ''}
        </section>

        <nav class="site-footer__col" aria-label="Navigasi cepat">
          <h3>Navigasi Cepat</h3>
          <ul class="footer-list">
            ${NAV_ITEMS.map((i) => `<li><a href="${pageUrl(i.key)}">${i.label}</a></li>`).join('')}
          </ul>
        </nav>

        <section class="site-footer__col" aria-label="Kontak">
          <h3>Kontak &amp; Jam Buka</h3>
          <ul class="footer-list">
            <li>💬 <a href="${waLink('Halo Dapur Manis Lestari, saya ingin bertanya.')}" target="_blank" rel="noopener noreferrer">WhatsApp ${escapeHTML(bisnis.teleponTampil)}</a></li>
            <li>📞 <a href="tel:${escapeHTML(telepon)}">${escapeHTML(bisnis.teleponTampil)}</a></li>
            ${instagram ? `<li>📸 <a href="${escapeHTML(instagram.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(handleIG)}</a></li>` : ''}
            <li>🕗 Setiap hari, ${escapeHTML(bisnis.jamBuka)}</li>
            <li>📍 ${escapeHTML(bisnis.kota)}</li>
          </ul>
        </section>

        <section class="site-footer__col" aria-label="Cabang utama">
          <h3>Cabang Utama</h3>
          ${utama ? `
          <p><strong>${escapeHTML(utama.nama)}</strong></p>
          <p>${escapeHTML(utama.alamat)}</p>
          <p>🕗 ${escapeHTML(utama.jam)}</p>
          <p class="footer-links-inline">
            <a href="${mapsUrl(utama.peta || utama.alamat)}" target="_blank" rel="noopener noreferrer">Buka di Maps</a>
            ${lainnya ? `· <a href="${pageUrl('cabang')}">+${lainnya} cabang lainnya</a>` : ''}
          </p>` : `<p><a href="${pageUrl('cabang')}">Lihat semua cabang</a></p>`}
        </section>
      </div>

    </div>

    <div class="site-footer__bottom"> <!-- strip paling bawah: warna di tokens.css (--color-footer-bottom) -->
      <div class="container">
        <p class="site-footer__copy">© ${new Date().getFullYear()} ${escapeHTML(bisnis.nama)}. All rights reserved.</p>
        <p class="site-footer__copy">Halal LPPOM MUI · Sejak ${escapeHTML(bisnis.tahunBerdiri)}</p>
      </div>
    </div>`;
}
