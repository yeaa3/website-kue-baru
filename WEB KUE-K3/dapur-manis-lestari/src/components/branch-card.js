import { escapeHTML } from '../utils/format.js';

/** Kartu cabang dengan peta Google Maps. Alamat peta diambil dari kolom `peta` (atau `alamat`). */
export function renderBranchCard(cabang, { embed = true } = {}) {
  const q = encodeURIComponent(cabang.peta || cabang.alamat);
  return `
  <article class="card branch-card">
    <div class="branch-card__main">
      <div class="branch-card__icon">${cabang.icon}</div>
      <div>
        <h3>${escapeHTML(cabang.nama)}</h3>
        <p class="muted">${escapeHTML(cabang.alamat)}</p>
        <p class="muted">🕗 ${escapeHTML(cabang.jam)}</p>
        <p class="branch-card__note">${escapeHTML(cabang.keunggulan)}</p>
      </div>
    </div>
    ${embed ? `<iframe class="branch-card__map" src="https://www.google.com/maps?q=${q}&output=embed" title="Peta ${escapeHTML(cabang.nama)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>` : ''}
    <div class="branch-card__actions">
      <a class="btn btn--soft btn--sm" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener noreferrer">📍 Buka di Google Maps</a>
      <a class="btn btn--primary btn--sm" href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener noreferrer">Rute</a>
    </div>
  </article>`;
}
