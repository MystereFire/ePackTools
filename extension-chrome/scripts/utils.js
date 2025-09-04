// Generic utility functions shared across popup and background
const utils = {
  normalizeText(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, '')
      .toLowerCase();
  },
  integratorKey(name) {
    if (!name) return '';
    const cleanName = name.replace(/_/g, ' ').trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length === 1) {
      return utils.normalizeText(parts[0]);
    }
    const prenomInitial = parts[0][0] || '';
    const nom = parts.slice(1).join('');
    return utils.normalizeText(prenomInitial + nom);
  },
  keysMatch(a, b) {
    if (!a || !b) return false;
    return a === b || a.startsWith(b) || b.startsWith(a);
  },
  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  splitName(name) {
    const parts = name.split(' ');
    const prenom = parts.find((p) => p[0] === p[0].toUpperCase());
    const nom = parts.filter((p) => p !== prenom).join(' ').toUpperCase();
    return { nom, prenom };
  },
  getLangId(code) {
    const map = {
      fr_FR: '1',
      en_US: '2',
      en_GB: '2',
      it_IT: '3',
      de_DE: '4',
      pt_PT: '5',
      pt_BR: '5',
      es_ES: '6',
      pl_PL: '7',
      ca_ES: '8',
      nl_NL: '9',
      zh_CN: '10',
      zh_TW: '10',
      ar_SY: '11',
      ar_EG: '11',
      ar: '11',
      el_GR: '12',
    };
    return map[code] || '1';
  },
  getLangFromCountry(country) {
    const map = {
      France: 'fr_FR',
      Belgique: 'fr_FR',
      Belgium: 'fr_FR',
      Suisse: 'fr_FR',
      Switzerland: 'fr_FR',
      Canada: 'en_US',
      RoyaumeUni: 'en_GB',
      UnitedKingdom: 'en_GB',
    };
    return map[country] || 'fr_FR';
  },
};

self.utils = utils;
