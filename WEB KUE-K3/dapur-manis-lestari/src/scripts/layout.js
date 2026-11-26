// Dipanggil oleh setiap halaman: merender header, footer, navigasi bawah, dan keranjang.
import { loadData } from '../utils/data.js';
import { setNomorWA, waLink } from '../utils/whatsapp.js';
import { renderHeader, renderBottomNav } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { initCart } from '../components/cart.js';

export async function initLayout(activeKey) {
  // Data cabang hanya tambahan untuk footer; bila gagal dimuat, footer tetap tampil tanpa bagian itu.
  const [bisnis, cabang] = await Promise.all([loadData('bisnis'), loadData('cabang').catch(() => [])]);
  setNomorWA(bisnis.whatsapp);

  document.getElementById('app-header').innerHTML = renderHeader(activeKey, bisnis);
  document.getElementById('app-bottom-nav').innerHTML = renderBottomNav(activeKey);
  document.getElementById('app-footer').innerHTML = renderFooter(bisnis, cabang);

  // Tautan statis di HTML cukup memakai data-wa="pesan awal".
  document.querySelectorAll('[data-wa]').forEach((a) => {
    a.href = waLink(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  initCart();
  return bisnis;
}
