const routePlace = document.querySelector('#route-place');
const routeTopic = document.querySelector('#route-topic');
const routeResult = document.querySelector('[data-route-result]');
const proposalForm = document.querySelector('[data-proposal-form]');
const proposalPlace = document.querySelector('#proposal-place');
const proposalCategory = document.querySelector('#proposal-category');
const prepareProposal = document.querySelector('[data-prepare-proposal]');
const proposalOutput = document.querySelector('[data-proposal-output]');
const proposalText = document.querySelector('[data-proposal-text]');
const copyProposal = document.querySelector('[data-copy-proposal]');
const copyStatus = document.querySelector('[data-copy-status]');

const placeNames = {
  vallendar: 'Stadt Vallendar',
  niederwerth: 'Niederwerth',
  urbar: 'Urbar',
  weitersburg: 'Weitersburg',
  all: 'mehreren Orten oder der gesamten Verbandsgemeinde'
};

function localRoute(place) {
  if (place === 'vallendar') {
    return {
      level: 'local',
      title: 'Voraussichtlich: Stadtrat Vallendar',
      copy: 'Örtliche Planungen, Einrichtungen und Angelegenheiten der Stadt gehören grundsätzlich in den Stadtrat. Die Verbandsgemeindeverwaltung bereitet viele Vorgänge lediglich verwaltungsmäßig vor.'
    };
  }

  if (place === 'urbar') {
    return {
      level: 'local',
      title: 'Voraussichtlich: Ortsgemeinderat Urbar',
      copy: 'Örtliche Planungen, Einrichtungen und Angelegenheiten Urbars gehören grundsätzlich in den Ortsgemeinderat. Die CDU-Fraktion kann das Thema nach Prüfung politisch aufgreifen.'
    };
  }

  if (place === 'niederwerth') {
    return {
      level: 'special',
      title: 'Voraussichtlich: Ortsgemeinderat Niederwerth',
      copy: 'Auf Niederwerth gibt es keine klassische CDU-Fraktion. Wir können die Zuständigkeit prüfen und einen sinnvollen örtlichen Kontakt oder Weiterleitungsweg benennen.'
    };
  }

  if (place === 'weitersburg') {
    return {
      level: 'special',
      title: 'Voraussichtlich: Ortsgemeinderat Weitersburg',
      copy: 'In Weitersburg besteht derzeit keine CDU-Ratsfraktion. Wir können das Anliegen einordnen und an eine geeignete Stelle oder einen örtlichen Ansprechpartner weitergeben.'
    };
  }

  return {
    level: 'check',
    title: 'Örtliche Ebene noch eingrenzen',
    copy: 'Bei einer örtlichen Angelegenheit muss zunächst geklärt werden, welche Stadt oder Ortsgemeinde betroffen ist und wem die Straße, Fläche oder Einrichtung gehört.'
  };
}

function getRoute(place = routePlace?.value, topic = routeTopic?.value) {
  if (!topic || topic === 'unknown') {
    return {
      level: 'open',
      title: 'Themenfeld noch auswählen',
      copy: 'Danach zeigen wir, wo das Anliegen voraussichtlich hingehört und welchen politischen Weg wir empfehlen.'
    };
  }

  if (topic === 'local') return localRoute(place);

  if (topic === 'vg') {
    return {
      level: 'vg',
      title: 'Voraussichtlich: Verbandsgemeinderat',
      copy: 'Grundschulen, Feuerwehr, Wasser, Abwasser, zentrale Sport- und Freizeitanlagen sowie der Flächennutzungsplan sind typische Aufgaben der Verbandsgemeinde. Hier ist die CDU-Fraktion im VG-Rat der politische Ansprechpartner.'
    };
  }

  if (topic === 'admin') {
    return {
      level: 'admin',
      title: 'Voraussichtlich: Verbandsgemeindeverwaltung',
      copy: 'Das ist häufig ein Verwaltungs- oder Behördenvorgang und nicht automatisch ein Thema für den VG-Rat. Wir prüfen, ob eine direkte Meldung, eine Anfrage oder dennoch ein politischer Antrag sinnvoll ist.'
    };
  }

  if (topic === 'county') {
    return {
      level: 'county',
      title: 'Voraussichtlich: Landkreis Mayen-Koblenz',
      copy: 'Das Thema gehört wahrscheinlich zur Kreisverwaltung oder in den Kreistag. Wir können den Sachverhalt einordnen und bei Bedarf an die zuständige CDU-Kreistagsfraktion weitergeben.'
    };
  }

  if (topic === 'higher') {
    return {
      level: 'higher',
      title: 'Voraussichtlich: Land oder Bund',
      copy: 'Der örtliche Rat kann hier meist nicht selbst entscheiden. Bei einem konkreten Bezug zu unserer Verbandsgemeinde prüfen wir, ob eine Weitergabe an Landtags- oder Bundestagsabgeordnete sinnvoll ist.'
    };
  }

  return {
    level: 'check',
    title: 'Zuständigkeit wird im Einzelfall geprüft',
    copy: `Der Bezug zu ${placeNames[place] || 'unserer Region'} ist klar, die zuständige Ebene aber noch nicht. Genau solche Fälle sollten vor einem Antrag sorgfältig geklärt werden.`
  };
}

function updateRoute() {
  if (!routeResult) return;
  const route = getRoute();
  routeResult.dataset.level = route.level;
  routeResult.querySelector('h3').textContent = route.title;
  routeResult.querySelector('p').textContent = route.copy;
}

routePlace?.addEventListener('change', updateRoute);
routeTopic?.addEventListener('change', updateRoute);

proposalPlace?.addEventListener('change', () => {
  if (routePlace && proposalPlace.value !== 'county') routePlace.value = proposalPlace.value;
  if (routePlace && proposalPlace.value === 'county') routePlace.value = 'all';
  updateRoute();
});

proposalCategory?.addEventListener('change', () => {
  if (routeTopic) routeTopic.value = proposalCategory.value;
  updateRoute();
});

proposalForm?.addEventListener('submit', (event) => event.preventDefault());

prepareProposal?.addEventListener('click', () => {
  if (!proposalForm.reportValidity()) return;

  const place = proposalPlace.options[proposalPlace.selectedIndex].text;
  const location = document.querySelector('#proposal-location').value.trim();
  const topic = document.querySelector('#proposal-topic').value.trim();
  const situation = document.querySelector('#proposal-situation').value.trim();
  const goal = document.querySelector('#proposal-goal').value.trim();
  const urgency = document.querySelector('#proposal-urgency').value;
  const route = getRoute();

  proposalText.value = [
    'THEMENVORSCHLAG FÜR DIE CDU IN DER VERBANDSGEMEINDE VALLENDAR',
    '',
    `Ort / räumlicher Bezug: ${place}`,
    `Genaue Stelle oder Einrichtung: ${location || 'nicht angegeben'}`,
    `Erste Zuständigkeitseinordnung: ${route.title.replace('Voraussichtlich: ', '')}`,
    '',
    `THEMA: ${topic}`,
    '',
    'AUSGANGSLAGE',
    situation,
    '',
    'GEWÜNSCHTES ZIEL',
    goal,
    '',
    `Zeitlicher Bezug: ${urgency}`,
    '',
    'Hinweis: Dies ist ein politischer Themenvorschlag. Er ist noch kein förmlicher Antrag an einen Rat, keine Petition und kein Einwohnerantrag.'
  ].join('\n');

  proposalOutput.hidden = false;
  proposalOutput.setAttribute('tabindex', '-1');
  proposalOutput.focus({ preventScroll: true });
  proposalOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
  copyStatus.textContent = '';
});

copyProposal?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(proposalText.value);
    copyStatus.textContent = 'Der Text wurde in die Zwischenablage kopiert.';
  } catch {
    proposalText.focus();
    proposalText.select();
    copyStatus.textContent = 'Der Text ist markiert. Bitte kopieren Sie ihn mit Strg+C beziehungsweise Cmd+C.';
  }
});

updateRoute();
