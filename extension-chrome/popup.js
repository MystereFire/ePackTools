// Popup acts only as an interface to the background job queue

document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');

  function refresh() {
    chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
      if (!res || !res.jobs) return;
      output.textContent = res.jobs
        .map((j) => `${j.type} – ${j.state}`)
        .join('\n');
    });
  }

  const buttons = [
    'createSolution',
    'createUser',
    'openParam',
    'doAll',
    'connectAll',
    'doEverything',
    'openSonde',
  ];

  buttons.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'enqueue',
        jobType: id,
        payload: {},
      });
    });
  });

  refresh();
  setInterval(refresh, 1000);
});
