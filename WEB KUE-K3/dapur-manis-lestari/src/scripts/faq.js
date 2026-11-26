import { initLayout } from './layout.js';
import { loadData } from '../utils/data.js';
import { renderFAQ } from '../components/faq.js';

const $ = (selector) => document.querySelector(selector);

async function init() {
  const [, faq] = await Promise.all([initLayout('faq'), loadData('faq')]);
  const akordeon = renderFAQ($('#faq-list'), faq, { bukaPertama: true });

  $('#faq-jumlah').textContent = `${faq.length} pertanyaan`;

  // Pencarian di dalam FAQ
  $('#cari-faq').addEventListener('input', (e) => {
    const cocok = akordeon.filter(e.target.value);
    $('#faq-kosong').hidden = cocok > 0;
    $('#faq-jumlah').textContent = e.target.value.trim()
      ? `${cocok} dari ${faq.length} pertanyaan`
      : `${faq.length} pertanyaan`;
  });
}

init().catch((err) => {
  console.error(err);
  $('#faq-list').innerHTML = '<div class="card empty-state"><h3>FAQ belum bisa dimuat</h3><p class="muted">Silakan muat ulang halaman atau hubungi kami via WhatsApp.</p></div>';
});
