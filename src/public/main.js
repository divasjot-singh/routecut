const form = document.querySelector('.url-form');
const input = document.querySelector('.url-input');
const resultContainer = document.getElementById('result-container');
const shortUrlAnchor = document.getElementById('short-url');
const copyBtn = document.getElementById('copy-btn');
const toastContainer = document.getElementById('toast-container');

let currentShortUrl = '';

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  // check icon
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

form.addEventListener('submit', event => {
  event.preventDefault();

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '...';
  submitBtn.disabled = true;

  fetch('/new', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: input.value,
    })
  })
    .then(response => {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      return response.json();
    })
    .then(data => {
      currentShortUrl = `${location.origin}/${data.short_id}`;
      shortUrlAnchor.href = `/${data.short_id}`;
      shortUrlAnchor.textContent = currentShortUrl;
      resultContainer.classList.remove('hidden');
      input.value = '';
    })
    .catch(error => {
      console.error(error);
      alert('Failed to shorten URL. Make sure it is a valid URL.');
    })
    .finally(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });
});

copyBtn.addEventListener('click', () => {
  if (!currentShortUrl) return;
  
  navigator.clipboard.writeText(currentShortUrl).then(() => {
    showToast('Link copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
});
