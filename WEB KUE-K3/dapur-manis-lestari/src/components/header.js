import { pageUrl } from '../utils/paths.js';
import { escapeHTML } from '../utils/format.js';

/** Urutan menu di header, navigasi bawah (mobile), dan footer. Alamatnya diatur di utils/paths.js. */
export const NAV_ITEMS = [
  { key: 'beranda', label: 'Beranda', icon: '🏠' },
  { key: 'produk', label: 'Produk', icon: '🎂' },
  { key: 'cara-pesan', label: 'Cara Pesan', icon: '📖' },
  { key: 'faq', label: 'FAQ', icon: '❓' },
  { key: 'cabang', label: 'Cabang', icon: '🏪' },
];

const navLink = (item, active, withIcon) =>
  `<a href="${pageUrl(item.key)}" class="${item.key === active ? 'is-active' : ''}"${item.key === active ? ' aria-current="page"' : ''}>` +
  (withIcon ? `<span>${item.icon}</span><span>${item.label}</span>` : item.label) +
  `</a>`;

export function renderHeader(active, bisnis) {
  return `
    <div class="container site-header__inner">
      <a class="brand" href="${pageUrl('beranda')}">
        <span class="brand__mark">🧁</span><span>${escapeHTML(bisnis.namaPendek)}</span>
      </a>
      <nav class="main-nav" aria-label="Navigasi utama">
        ${NAV_ITEMS.map((i) => navLink(i, active, false)).join('')}
      </nav>
      <div class="site-header__actions">
        <button class="cart-trigger" type="button" data-cart-open aria-label="Buka keranjang">
          🛍️<span class="cart-badge" data-cart-count>0</span>
        </button>
      </div>
    </div>`;
}

export function renderBottomNav(active) {
  return NAV_ITEMS.map((i) => navLink(i, active, true)).join('');
}
