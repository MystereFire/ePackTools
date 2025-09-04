// Background workflows executed for each job type
async function runJob(job) {
  switch (job.type) {
    case 'createSolution':
      job.logs.push('Création de la solution...');
      // placeholder logic
      await utils.wait(1000);
      break;
    case 'createUser':
      job.logs.push('Création de l\'utilisateur...');
      await utils.wait(1000);
      break;
    case 'openParam':
      job.logs.push('Ouverture des paramètres...');
      await utils.wait(500);
      break;
    case 'doAll':
      job.logs.push('Workflow complet démarré...');
      await utils.wait(1000);
      break;
    case 'connectAll':
      job.logs.push('Association des sondes...');
      await utils.wait(1000);
      break;
    case 'doEverything':
      job.logs.push('Exécution totale...');
      await utils.wait(1000);
      break;
    case 'openSonde':
      job.logs.push('Test sondes...');
      await utils.wait(500);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

self.runJob = runJob;
