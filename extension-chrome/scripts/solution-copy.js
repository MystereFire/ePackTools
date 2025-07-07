(function() {
  function addCopyButton() {
    const ths = Array.from(document.querySelectorAll('table tbody tr th'));
    const th = ths.find(el => el.textContent.trim() === 'MailSolution');
    if (!th) return;

    const td = th.nextElementSibling;
    if (!td) return;

    const email = td.textContent.trim();
    if (!email) return;

    if (td.querySelector('.epack-copy-btn')) return;

    const btn = document.createElement('button');
    btn.textContent = 'Copier';
    btn.className = 'epack-copy-btn';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(email).then(() => {
        btn.textContent = 'Copié!';
        setTimeout(() => {
          btn.textContent = 'Copier';
        }, 1000);
      });
    });

    td.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButton);
  } else {
    addCopyButton();
  }
})();
