const routePlace = document.querySelector('#route-place');
const routeTopic = document.querySelector('#route-topic');
const routeResult = document.querySelector('[data-route-result]');
const proposalForm = document.querySelector('[data-proposal-form]');
const proposalPlace = document.querySelector('#proposal-place');
const proposalCategory = document.querySelector('#proposal-category');
const proposalOutput = document.querySelector('[data-proposal-output]');
const proposalText = document.querySelector('[data-proposal-text]');
const copyProposal = document.querySelector('[data-copy-proposal]');
const copyStatus = document.querySelector('[data-copy-status]');
const selectionStatus = document.querySelector('[data-proposal-selection-status]');
// Der Finder darf nur Angaben vorfüllen, die im Formular noch nicht selbst
// geändert wurden. Ort und Themenfeld werden unabhängig voneinander geschützt.
const editedSelections = new Set();
const routeDetail = document.querySelector('#route-detail');
const proposalDetail = document.querySelector('#proposal-detail');
const topics = {
  local: ['Örtliche Planung, Plätze, Bürgerhaus oder Spielplatz', []],
  school: ['Schule', [['primary','Grundschule am gewählten Ort'],['kas','Konrad-Adenauer-Schule'],['marienschule','Schönstätter Marienschule'],['teaching','Unterricht oder Lehrkräfte'],['other','Andere Schule / unklar']]],
  kita: ['Kita und Betreuung', [['place','Betreuungsplatz / Platzbedarf'],['operation','Betrieb, Betreuung oder Personal'],['building','Gebäude, Ausbau oder Finanzierung']]],
  road: ['Straße oder Verkehrsregelung', [['municipal','Gemeindestraße: Schaden oder Ausbau'],['classified','Kreis-, Landes- oder Bundesstraße'],['traffic','Verkehrszeichen, Tempolimit oder Verkehrsführung'],['unknown','Straßenklasse unklar']]],
  water: ['Trinkwasser', []],
  wastewater: ['Abwasser und Kanal', []],
  waste: ['Abfall und Entsorgung', []],
  building: ['Baugenehmigung oder konkretes Bauvorhaben', []],
  vg: ['Feuerwehr oder Flächennutzungsplan', [['fire','Feuerwehr / Brandschutz'],['fnp','Flächennutzungsplan']]],
  facility: ['Sportanlage, Friedhof oder andere Einrichtung', []],
  county: ['Bus, Bahn oder Schülerbeförderung', [['bus','Busangebot / Fahrplan'],['schoolbus','Schülerbeförderung / Fahrtkosten'],['train','Bahnverkehr'],['service','Ausfall oder Beschwerde über eine Fahrt']]],
  admin: ['Ordnungsangelegenheit oder Verwaltungsverfahren', []],
  social: ['Jugend oder Soziales', []],
  higher: ['Landes- oder Bundesgesetz', []],
  unclear: ['Etwas anderes / noch unklar', []]
};
function setOptions(select, entries, placeholder) {
  select.replaceChildren();
  for (const [value, label] of [['', placeholder], ...entries]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}
for (const select of [routeTopic, proposalCategory]) {
  setOptions(select, Object.entries(topics).map(([key, item]) => [key, item[0]]), 'Bitte auswählen');
}
function detailsFor(topic, select) {
  const entries = topics[topic]?.[1] || [];
  setOptions(select, entries, 'Bitte eingrenzen / noch unklar');
  select.closest('.field-group').hidden = !entries.length;
}
function scopedRoute(place, topic, detail) {
  const result = (title, office, political, uncertain = false) => ({
    level: uncertain ? 'check' : topic, title,
    office, political,
    copy: `Erste Anlaufstelle: ${office} Politischer Weg: ${political}${uncertain ? ' Einzelfallprüfung: Träger, Zuständigkeit und Entscheidungsbefugnis müssen vor einer Weitergabe geklärt werden.' : ''}`
  });
  const local = localRoute(place);
  const localPolitical = `${local.title}; zuständiger Ausschuss, Bürgermeister oder Rat je nach Entscheidungsbefugnis.`;
  if (topic === 'school') {
    if (detail === 'primary') return result(
      ['vallendar','urbar','niederwerth','weitersburg'].includes(place) ? `Schulträger: ${place === 'vallendar' ? 'Stadt Vallendar' : `Ortsgemeinde ${placeNames[place]}`}` : 'Grundschule: Ort noch eingrenzen',
      'Schulträger für Gebäude und Sachausstattung; Schulleitung für schulinterne Fragen.',
      localPolitical, !['vallendar','urbar','niederwerth','weitersburg'].includes(place));
    if (detail === 'kas') return result('Schulträger: Verbandsgemeinde Vallendar', 'VG-Verwaltung für Trägerangelegenheiten der Konrad-Adenauer-Schule.', 'Schulträgerausschuss und VG-Rat im Rahmen ihrer Befugnisse.');
    if (detail === 'marienschule') return result('Schönstätter Marienschule: freier Träger', 'Schule und Provinzialat der Schönstätter Marienschwestern.', 'Kein kommunaler Rat als Schulträger; öffentliche Beteiligung nur anlassbezogen prüfen.');
    if (detail === 'teaching') return result('Schulleitung / zuständige Schulaufsicht', 'Zunächst Schulleitung; zuständige Schulaufsicht abhängig von Schule und Anliegen.', 'Kommunale Schulträgerschaft bedeutet keine Entscheidung über Unterricht oder Lehrkräfte.', true);
    return result('Schulträger noch klären', 'Konkrete Schule und Anliegen benennen.', 'Nicht pauschal an den Landkreis oder VG-Rat verweisen.', true);
  }
  if (topic === 'kita') return result('Kita: Einrichtung und Anliegen prüfen',
    detail === 'place' ? 'Einrichtung/Träger für die Anmeldung; Kreisjugendamt MYK bei ungedecktem Platzbedarf und Bedarfsplanung.' : 'Konkrete Kita und Betriebsträger benennen; Gebäudezuständigkeit und Finanzierung getrennt prüfen.',
    'Kommunale Kita: betreffende Stadt/Ortsgemeinde. Freier oder kirchlicher Träger: dessen Zuständigkeit beachten; kommunale Beteiligung und Kreisjugendamt je nach Anliegen.', true);
  if (topic === 'road') {
    if (detail === 'municipal') return result('Gemeindestraße: örtliche Ebene', 'Zuständige Verwaltung für die konkrete Straße und den betroffenen Abschnitt.', localPolitical, !['vallendar','urbar','niederwerth','weitersburg'].includes(place));
    if (detail === 'traffic') return result('Straßenverkehrsbehörde', 'Straßenverkehrsbehörde der VG Vallendar zur Einordnung der Verkehrsregelung.', 'Verkehrsrechtliche Anordnung ist kein frei verfügbarer Ratsbeschluss; konkrete Zuständigkeit prüfen.', true);
    return result('Straßenbaulast und Straßenabschnitt prüfen', 'Straßenklasse und Abschnitt benennen; bei Kreis-, Landes- und Bundesstraßen den zuständigen Straßenbaulastträger beziehungsweise LBM ermitteln.', 'Straßenbau und Verkehrsregelung trennen. Nicht automatisch an Abgeordnete weiterleiten.', true);
  }
  if (topic === 'water') return result('Trinkwasser: VWM / evm', 'Vereinigte Wasserwerke Mittelrhein; evm als Betriebsführerin für Versorgung, Anschluss und Störungen.', 'Kommunale Grundsatz- und Beteiligungsfragen gesondert prüfen; nicht jede Betriebsfrage gehört in den VG-Rat.');
  if (topic === 'wastewater') return result('Abwasser: Verbandsgemeinde Vallendar', 'Abwasserbeseitigung der VG für Kanal- und Betriebsfragen.', 'Werkausschuss und VG-Rat entsprechend Betriebssatzung; laufende Verwaltung und Betrieb davon unterscheiden.');
  if (topic === 'waste') return result('Abfallzweckverband Rhein-Mosel-Eifel', 'Zweckverband für reguläre Abfallentsorgung und Abfuhr; Sonderfälle wie illegale Ablagerung gesondert zuordnen.', 'Verbandsangelegenheiten von örtlichen Maßnahmen unterscheiden.');
  if (topic === 'building') return result('Baugenehmigung: Kreisbauaufsicht MYK', 'Untere Bauaufsichtsbehörde der Kreisverwaltung; VG-Verwaltung für örtliche Verfahrensfragen.', 'Gemeindliches Einvernehmen und Beteiligung sind von der Baugenehmigung getrennt. Zuständiges örtliches Organ im Einzelfall prüfen.');
  if (topic === 'vg') return result('Verbandsgemeinde Vallendar', 'VG-Verwaltung für Feuerwehr/Brandschutz beziehungsweise Flächennutzungsplanung.', 'Zuständige VG-Organe; beim Flächennutzungsplan gesetzliche Beteiligung der Stadt und Ortsgemeinden beachten.');
  if (topic === 'county') {
    if (detail === 'bus' || detail === 'schoolbus') return result('Landkreis Mayen-Koblenz', 'Kreisverwaltung: ÖPNV beziehungsweise Schülerbeförderung/Fahrtkosten.', 'Kreisgremien bei Grundsatzfragen; einzelne Leistungsanträge an die Verwaltung.');
    return result('Verkehrsangebot und Betreiber prüfen', 'Bei Bahnverkehr zuständigen SPNV-Aufgabenträger, bei einzelnen Fahrten Verkehrsunternehmen ermitteln.', 'Bus, Bahn, Haltestellenbau und Betriebsbeschwerden haben unterschiedliche Zuständigkeiten.', true);
  }
  if (topic === 'facility') return result('Einrichtungsträger prüfen', 'Konkrete Sportanlage, Friedhof oder Einrichtung benennen; Eigentümer und Betreiber können verschieden sein.', 'Nicht allein aus Standort oder überörtlicher Nutzung eine VG-Zuständigkeit ableiten.', true);
  if (topic === 'social') return result('Jugend / Soziales: konkrete Leistung prüfen', 'Kreisjugendamt, Sozialverwaltung oder örtliche Stelle je nach Anliegen.', 'Örtliche Jugendarbeit und Einrichtungen von gesetzlichen Hilfen unterscheiden.', true);
  if (topic === 'admin') return result('Verwaltungszuständigkeit prüfen', 'VG-Verwaltung zur ersten Einordnung; Genehmigungsbehörde kann eine andere Stelle sein.', 'Kein automatischer Ratsvorgang.', true);
  return null;
}

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
      title: 'Stadt Vallendar',
      copy: 'Örtliche Planungen, Einrichtungen und Angelegenheiten der Stadt sind Aufgaben der Stadt. Rat, Ausschuss und Bürgermeister entscheiden im Rahmen ihrer jeweiligen Befugnisse. Die Bearbeitung durch die VG-Verwaltung begründet keine Zuständigkeit des VG-Rates.'
    };
  }

  if (place === 'urbar') {
    return {
      level: 'local',
      title: 'Ortsgemeinde Urbar',
      copy: 'Örtliche Planungen, Einrichtungen und Angelegenheiten Urbars sind Aufgaben der Ortsgemeinde. Rat, Ausschuss und Bürgermeister entscheiden im Rahmen ihrer jeweiligen Befugnisse. Die CDU-Fraktion kann das Thema politisch aufgreifen.'
    };
  }

  if (place === 'niederwerth') {
    return {
      level: 'special',
      title: 'Ortsgemeinde Niederwerth',
      copy: 'Auf Niederwerth gibt es keine klassische CDU-Fraktion. Wir können die Zuständigkeit prüfen und einen sinnvollen örtlichen Kontakt oder Weiterleitungsweg benennen.'
    };
  }

  if (place === 'weitersburg') {
    return {
      level: 'special',
      title: 'Ortsgemeinde Weitersburg',
      copy: 'In Weitersburg besteht derzeit keine CDU-Ratsfraktion. Wir können das Anliegen einordnen und an eine geeignete Stelle oder einen örtlichen Ansprechpartner weitergeben.'
    };
  }

  return {
    level: 'check',
    title: 'Örtliche Ebene noch eingrenzen',
    copy: 'Bei einer örtlichen Angelegenheit muss zunächst geklärt werden, welche Stadt oder Ortsgemeinde betroffen ist und wem die Straße, Fläche oder Einrichtung gehört.'
  };
}

function getRoute(place, topic, detail = '') {
  if (!topic || topic === 'unknown') {
    return {
      level: 'open',
      title: 'Themenfeld noch auswählen',
      copy: 'Danach zeigen wir die zuständige Ebene und den passenden Weg. Fehlen entscheidende Angaben, kennzeichnen wir die Einzelfallprüfung.'
    };
  }

  const scoped = scopedRoute(place, topic, detail);
  if (scoped) return scoped;
  if (topic === 'local') {
    const route = localRoute(place);
    route.copy += ' Erste Anlaufstelle: zuständige örtliche Verwaltung. Politischer Weg: Bürgermeister, zuständiger Ausschuss oder Rat entsprechend Entscheidungsbefugnis. Bei unklarem Eigentümer oder Träger: Einzelfallprüfung.';
    return route;
  }

  if (topic === 'higher') {
    return {
      level: 'higher',
      title: 'Land oder Bund: konkrete Zuständigkeit prüfen',
      copy: 'Der örtliche Rat kann hier meist nicht selbst entscheiden. Bei einem konkreten Bezug zu unserer Verbandsgemeinde prüfen wir, ob eine Weitergabe an Landtags- oder Bundestagsabgeordnete sinnvoll ist.'
    };
  }

  return {
    level: 'check',
    title: 'Zuständigkeit wird im Einzelfall geprüft',
    copy: `Einzelfallprüfung: Für das Anliegen ${placeNames[place] ? `mit Bezug zu ${placeNames[place]}` : 'mit noch offenem Ortsbezug'} sind zuständige Stelle und politischer Weg noch zu klären. Bitte Ort, Einrichtung und gewünschte Entscheidung möglichst genau benennen.`
  };
}

function updateRoute() {
  if (!routeResult) return;
  const route = getRoute(routePlace?.value, routeTopic?.value, routeDetail?.value);
  routeResult.dataset.level = route.level;
  routeResult.querySelector('h3').textContent = route.title;
  routeResult.querySelector('p').textContent = route.copy;
}

function prefillSelection(source, target) {
  if (!source || !target) return;
  if (editedSelections.has(target)) {
    if (selectionStatus) selectionStatus.textContent = 'Ihre im Formular selbst gewählten Angaben bleiben erhalten. Für den Textentwurf gilt die Auswahl hier im Formular.';
    return;
  }
  const value = source.value === 'unknown' ? '' : source.value;
  if (target.value !== value) {
    target.value = value;
    invalidateProposal();
  }
  if (selectionStatus) selectionStatus.textContent = 'Die Auswahl aus dem Zuständigkeitsfinder wurde übernommen. Sie können die Angaben hier prüfen und ändern.';
}

routePlace?.addEventListener('change', () => {
  prefillSelection(routePlace, proposalPlace);
  updateRoute();
});
routeTopic?.addEventListener('change', () => {
  prefillSelection(routeTopic, proposalCategory);
  detailsFor(routeTopic.value, routeDetail);
    if (!editedSelections.has(proposalCategory)) {
      detailsFor(proposalCategory.value, proposalDetail);
      editedSelections.delete(proposalDetail);
    }
  updateRoute();
});

proposalPlace?.addEventListener('change', () => {
  editedSelections.add(proposalPlace);
  if (routePlace && proposalPlace.value !== 'county') routePlace.value = proposalPlace.value;
  if (routePlace && proposalPlace.value === 'county') routePlace.value = 'all';
  updateRoute();
});

proposalCategory?.addEventListener('change', () => {
  editedSelections.add(proposalCategory);
  if (routeTopic) routeTopic.value = proposalCategory.value;
  detailsFor(proposalCategory.value, proposalDetail);
  detailsFor(routeTopic.value, routeDetail);
  updateRoute();
});

function invalidateProposal() {
  proposalOutput.hidden = true;
  proposalText.value = '';
  copyStatus.textContent = '';
}

proposalForm?.addEventListener('input', invalidateProposal);
proposalForm?.addEventListener('change', invalidateProposal);

proposalForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!proposalForm.reportValidity()) return;

  const place = proposalPlace.options[proposalPlace.selectedIndex].text;
  const location = document.querySelector('#proposal-location').value.trim();
  const topic = document.querySelector('#proposal-topic').value.trim();
  const situation = document.querySelector('#proposal-situation').value.trim();
  const goal = document.querySelector('#proposal-goal').value.trim();
  const urgency = document.querySelector('#proposal-urgency').value;
  // Der Finder darf unabhängig benutzt werden. Der Entwurf gehört stets
  // zu den Orts- und Themenangaben im Formular selbst.
  const route = getRoute(proposalPlace.value, proposalCategory.value, proposalDetail.value);

  proposalText.value = [
    'THEMENVORSCHLAG FÜR DIE CDU IN DER VERBANDSGEMEINDE VALLENDAR',
    '',
    `Ort / räumlicher Bezug: ${place}`,
    `Genaue Stelle oder Einrichtung: ${location || 'nicht angegeben'}`,
    `Erste Zuständigkeitseinordnung: ${route.title}`,
    `Themenfeld: ${topics[proposalCategory.value]?.[0] || 'offen'}`,
    `Konkretisierung: ${proposalDetail.value ? proposalDetail.options[proposalDetail.selectedIndex].text : 'noch unklar / nicht erforderlich'}`,
    route.copy,
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

routeDetail.addEventListener('change', () => {
  if (!editedSelections.has(proposalCategory) && !editedSelections.has(proposalDetail)) {
    proposalDetail.value = routeDetail.value;
    invalidateProposal();
  }
  updateRoute();
});
proposalDetail.addEventListener('change', () => {
  editedSelections.add(proposalDetail);
  if (routeTopic.value === proposalCategory.value) routeDetail.value = proposalDetail.value;
  updateRoute();
});
detailsFor('', routeDetail);
detailsFor('', proposalDetail);
updateRoute();
