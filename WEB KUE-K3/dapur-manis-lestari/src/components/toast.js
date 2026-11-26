let element;
let timer;

export function showToast(pesan) {
  if (!element) {
    element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    document.body.append(element);
  }
  element.textContent = pesan;
  element.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove('is-visible'), 2200);
}
