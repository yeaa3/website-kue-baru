import { escapeHTML } from '../utils/format.js';
import { normalisasi } from '../utils/search.js';

/**
 * Menampilkan FAQ sebagai akordeon interaktif.
 * @param {HTMLElement} container
 * @param {{pertanyaan:string, jawaban:string}[]} daftarFaq
 * @param {{singleOpen?:boolean, bukaPertama?:boolean}} opsi
 *   singleOpen  : hanya satu item terbuka pada satu waktu (default true)
 *   bukaPertama : buka item pertama saat halaman dimuat
 * @returns {{filter:(kata:string)=>number, bukaSemua:()=>void, tutupSemua:()=>void}}
 *   `filter` menyembunyikan item yang tidak cocok dan mengembalikan jumlah yang cocok.
 */
export function renderFAQ(container, daftarFaq, { singleOpen = true, bukaPertama = false } = {}) {
  container.innerHTML = daftarFaq
    .map((item, n) => `
      <details id="faq-${n + 1}">
        <summary>${escapeHTML(item.pertanyaan)}</summary>
        <p>${escapeHTML(item.jawaban)}</p>
      </details>`)
    .join('');

  const semua = [...container.querySelectorAll('details')];
  const teks = daftarFaq.map((item) => normalisasi(`${item.pertanyaan} ${item.jawaban}`));

  if (singleOpen) {
    semua.forEach((detail) => {
      detail.addEventListener('toggle', () => {
        if (!detail.open) return;
        semua.forEach((lain) => { if (lain !== detail) lain.open = false; });
      });
    });
  }

  // Tautan langsung ke satu pertanyaan, mis. faq.html#faq-2
  const target = location.hash ? semua.find((d) => d.id === location.hash.slice(1)) : null;
  if (target) {
    target.open = true;
    target.scrollIntoView({ block: 'center' });
  } else if (bukaPertama && semua[0]) {
    semua[0].open = true;
  }

  return {
    filter(kata) {
      const cari = normalisasi(kata);
      let cocok = 0;
      semua.forEach((detail, i) => {
        const tampil = !cari || cari.split(/\s+/).every((t) => teks[i].includes(t));
        detail.hidden = !tampil;
        if (tampil) cocok += 1;
      });
      return cocok;
    },
    bukaSemua() { semua.forEach((d) => { if (!d.hidden) d.open = true; }); },
    tutupSemua() { semua.forEach((d) => { d.open = false; }); },
  };
}
