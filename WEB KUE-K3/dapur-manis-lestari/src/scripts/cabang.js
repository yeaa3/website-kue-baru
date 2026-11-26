import { initLayout } from './layout.js';
import { loadData } from '../utils/data.js';
import { renderBranchCard } from '../components/branch-card.js';

Promise.all([initLayout('cabang'), loadData('cabang')])
  .then(([, cabang]) => {
    document.getElementById('cabang-list').innerHTML = cabang.map((c) => renderBranchCard(c)).join('');
  })
  .catch((err) => console.error(err));
