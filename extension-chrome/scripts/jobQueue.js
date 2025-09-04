// Simple persistent job queue stored in chrome.storage.local
const JOBS_KEY = 'jobs';
let processing = false;

function loadQueue() {
  return new Promise((resolve) => {
    chrome.storage.local.get(JOBS_KEY, (data) => {
      resolve(data[JOBS_KEY] || []);
    });
  });
}

function saveQueue(queue) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [JOBS_KEY]: queue }, resolve);
  });
}

async function addJob(job) {
  const queue = await loadQueue();
  job.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  job.state = 'queued';
  job.logs = [];
  job.progress = 0;
  job.createdAt = Date.now();
  queue.push(job);
  await saveQueue(queue);
  processQueue();
  return job.id;
}

async function updateJob(job) {
  const queue = await loadQueue();
  const idx = queue.findIndex((j) => j.id === job.id);
  if (idx !== -1) {
    queue[idx] = job;
    await saveQueue(queue);
  }
}

async function cancelJob(id) {
  const queue = await loadQueue();
  const job = queue.find((j) => j.id === id);
  if (job) {
    job.state = 'canceled';
    job.finishedAt = Date.now();
    await saveQueue(queue);
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;
  const queue = await loadQueue();
  const job = queue.find((j) => j.state === 'queued' || j.state === 'running');
  if (!job) {
    processing = false;
    return;
  }
  job.state = 'running';
  job.startedAt = job.startedAt || Date.now();
  await saveQueue(queue);
  try {
    await runJob(job); // runJob provided by workflows.js
    job.state = 'done';
    job.progress = 100;
    job.finishedAt = Date.now();
    job.logs.push('Job completed');
    chrome.notifications.create(job.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${job.type} terminé`,
      message: 'La tâche est terminée',
    });
  } catch (e) {
    job.state = 'error';
    job.error = e.message;
    job.finishedAt = Date.now();
    job.logs.push(e.message);
    chrome.notifications.create(job.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${job.type} erreur`,
      message: e.message,
    });
  }
  await updateJob(job);
  processing = false;
  // process next job if any
  const q = await loadQueue();
  if (q.some((j) => j.state === 'queued')) {
    processQueue();
  }
}

async function getJobs() {
  return loadQueue();
}

self.jobQueue = { addJob, cancelJob, getJobs, processQueue };
