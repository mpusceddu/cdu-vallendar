# CDU in der Verbandsgemeinde Vallendar

Gemeinsamer Internetauftritt der CDU in Vallendar, Niederwerth, Urbar und Weitersburg.

**Öffentliche Entwicklungsfassung:** https://mpusceddu.github.io/cdu-vallendar/

## Projektstand

Die Website bildet den CDU-Gemeindeverband, den Vorstand, die Fraktionen und die unterschiedlichen politischen Situationen in den fünf Räten ab. Impressum und Datenschutz sind vorhanden.

Vor dem offiziellen Start bleiben insbesondere diese Punkte offen:

- endgültige Domain
- Funktions-E-Mail-Adressen
- freigegebene Porträt- und Ortsfotos
- echte Meldungen und Termine
- abschließende inhaltliche Abnahme

## Seitenübersicht

| Bereich | Datei |
| --- | --- |
| Startseite | `index.html` |
| Themen und Anträge | `politik/index.html` |
| Thema vorschlagen | `thema-vorschlagen/index.html` |
| Vorstand und VG-Fraktionsführung | `team/index.html` |
| Räte und Fraktionen | `raete/index.html` |
| VG-Fraktion | `vg/index.html` |
| Stadt Vallendar | `vallendar/index.html` |
| Niederwerth | `niederwerth/index.html` |
| Urbar | `urbar/index.html` |
| Weitersburg | `weitersburg/index.html` |
| Impressum | `impressum/index.html` |
| Datenschutz | `datenschutz/index.html` |
| Fehlerseite | `404.html` |

Die gemeinsame Gestaltung liegt in `assets/styles.css`. Das Verhalten des mobilen Menüs liegt in `assets/site.js`, die Filterfunktion der Antragsübersicht in `assets/politik.js` und die lokale Themenwerkstatt in `assets/thema-vorschlagen.js`. Bilder und Logos werden unter `assets/images/` abgelegt.

Die Themenwerkstatt versendet und speichert derzeit keine Eingaben. Sie ordnet ein Anliegen im Browser einer voraussichtlichen kommunalen Ebene zu und erzeugt einen kopierbaren Textentwurf. Ein späterer Übermittlungsweg darf erst ergänzt werden, wenn Funktionsadresse, Empfänger, Datenschutzhinweise und organisatorische Bearbeitung feststehen.

Die Hauptnavigation ist auf allen Seiten gleich: Unsere Orte, Politik, Räte und Team. Abschnittslinks der jeweiligen Seite stehen getrennt unter dem Kopf. Der bisherige Abschnitt `#aktuelles` enthält weiterhin allgemeine Themen und wird als „Unser Anspruch“ verlinkt; ein Nachrichten- oder Veranstaltungskalender ist noch nicht vorhanden.

Die Entwicklungsfassung ist mit `noindex,nofollow` gekennzeichnet. Diese Suchmaschinenanweisung erst nach Vorstandsfreigabe und zusammen mit den endgültigen Domain-/SEO-Angaben entfernen. Sie ist kein Zugangsschutz; die Vorschau bleibt über ihre URL öffentlich erreichbar.

## Inhalte pflegen

### Meldung oder Startseitenthema ändern

Die drei Karten im Abschnitt `#aktuelles` stehen direkt in `index.html`. Pro Karte werden Rubrik, Überschrift, Kurztext und Link gepflegt.

Vor der Veröffentlichung prüfen:

- Ist die Aussage aktuell und politisch abgestimmt?
- Führt der Link auf eine vorhandene Seite oder belastbare Quelle?
- Sind Namen, Daten und Zahlen belegt?
- Wurden keine internen oder personenbezogenen Angaben versehentlich veröffentlicht?

### Antrag ergänzen

Neue Anträge werden in `politik/index.html` innerhalb von `.motion-grid` als weitere Karte ergänzt.

Das Attribut `data-council` bestimmt den Filter:

- `vg` für den Verbandsgemeinderat
- `vallendar` für den Stadtrat Vallendar
- `urbar` für den Ortsgemeinderat Urbar
- `niederwerth` für den Ortsgemeinderat Niederwerth
- `weitersburg` für den Ortsgemeinderat Weitersburg

Zu jedem Vorgang gehören Rat, Datum, verständlicher Titel, kurze Einordnung und ein Link zur öffentlichen Originalquelle. Wenn vorhanden, sollten zusätzlich Beratungsstand, Ergebnis und der öffentliche Beschluss verlinkt werden. Filter und Trefferzahl werden automatisch aus den Karten erzeugt; eine Zahl muss nicht von Hand geändert werden.

Der Zähler unterscheidet Einträge mit öffentlicher Quelle von ausgearbeiteten Initiativen, deren Einreichung öffentlich noch nicht belegt ist. Eine einstimmige Abstimmung kann auch nur eine Ausschussverweisung betreffen: Immer den tatsächlich beschlossenen Text lesen, nicht allein die Ergebnisüberschrift. Antragsdatum und Beratungs-/Beschlussdatum nur mit belegter Zuordnung benennen.

Ein bestimmter Rat kann direkt verlinkt werden, beispielsweise:

- `politik/?rat=vg#antraege`
- `politik/?rat=vallendar#antraege`
- `politik/?rat=urbar#antraege`
- `politik/?rat=niederwerth#antraege`
- `politik/?rat=weitersburg#antraege`

### Person oder Funktion ändern

Vorstandsmitglieder werden in `team/index.html` gepflegt. Mitglieder der jeweiligen Ratsfraktionen stehen auf der passenden Rats- oder Ortsseite.

Wichtig: **Parteimitgliedschaft, Fraktionszugehörigkeit und kommunales Amt sind unterschiedliche Angaben.** Änderungen deshalb nicht automatisch auf andere Seiten übertragen. Eine parteilose Person kann weiterhin Mitglied einer CDU-Fraktion sein.

Auf den Personenkarten werden reguläre Ratsmitglieder nur mit ihrem Mandat und gegebenenfalls mit dem Zusatz „Parteilos“ bezeichnet. Fraktionsvorsitz und Stellvertretung bleiben als Funktionen sichtbar.

Bei einer Änderung immer prüfen:

1. Ist die Person noch Parteimitglied?
2. Gehört sie weiterhin einer Fraktion an?
3. Besteht das Ratsmandat oder kommunale Amt fort?
4. Wird dieselbe Person auf einer weiteren Seite genannt?

### Vorstand wechseln

Bei einer Vorstandswahl sind mindestens folgende Stellen zu kontrollieren:

- `team/index.html`
- örtliche Seiten, sofern dort Vorstandsmitglieder aus dem jeweiligen Ort erscheinen
- Impressum, wenn sich die gesetzliche Vertretung oder redaktionelle Verantwortung ändert
- Beschreibung im GitHub-Profil

Die veröffentlichte Mitteilung zur Vorstandswahl sollte als Quelle erhalten bleiben oder durch eine neuere offizielle Quelle ersetzt werden.

### Fotos ergänzen

Nur freigegebene Dateien mit geklärten Bildrechten verwenden. Dateinamen klein, eindeutig und ohne Leerzeichen schreiben, beispielsweise `marco-pusceddu.jpg`. Große Originale vor der Veröffentlichung fürs Web verkleinern.

Der Alternativtext beschreibt knapp, wer oder was auf dem Bild zu sehen ist. Formulierungen wie „Bild“ oder „Foto von“ sind nicht nötig.

## Veröffentlichung

Die Website wird aus dem Branch `main` über GitHub Pages veröffentlicht. Änderungen sollten mit einer verständlichen Commit-Nachricht dokumentiert werden.

Nach jeder Veröffentlichung:

1. GitHub-Pages-Build abwarten.
2. Geänderte Seite mit einem neuen Abfragewert öffnen, zum Beispiel `?v=20260904-1`.
3. Links, Mobilansicht und Zwischenbreiten prüfen.
4. Kontrollieren, dass die Seite nicht horizontal über den Bildschirm hinausragt.
5. Bei Personen, Rechtstexten und Kontaktdaten die Live-Fassung nochmals lesen.

## Lokale Vorschau

Die Regressionstests laufen ohne Installation und ohne Netzwerkzugriff:

```bash
node scripts/check.mjs
```

Sie prüfen interne Links und Sprungmarken, gemeinsame CSS-Versionen sowie die echte Formular- und Filterlogik. Darstellung, native Formularvalidierung und das mobile Menü zusätzlich im Browser prüfen.

Im Projektverzeichnis einen einfachen lokalen Webserver starten:

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000/` öffnen. Das direkte Öffnen einzelner HTML-Dateien ist möglich, bildet relative Verlinkungen aber nicht immer zuverlässig ab.

## Technische Leitlinien

- statisches HTML, CSS und JavaScript ohne Baukastensystem
- keine Analyse- oder Trackingdienste
- keine Cookies durch die Website selbst
- Schriftarten werden lokal ausgeliefert
- externe Inhalte werden verlinkt und nicht ungefragt eingebettet
- Änderungen sollen auch ohne den ursprünglichen Entwickler nachvollziehbar bleiben

Das CDU-Gesamtlogo sowie die Schriften Inter und IBM Plex Serif stammen aus dem [CI-Portal der CDU Deutschlands](https://ci.cdu.de/). Die zugehörigen Lizenztexte liegen unter `assets/fonts/`.

## Hinweis zur eigenen Domain

Die Links in `404.html` verwenden derzeit den GitHub-Pages-Projektpfad `/cdu-vallendar/`. Beim Umzug auf eine eigene Domain müssen diese Links auf `/` beziehungsweise die endgültigen Pfade angepasst werden.

Für die bisherigen örtlichen Auftritte ist folgende Zielstruktur vorbereitet:

| Bisherige Domain | Späteres Ziel |
| --- | --- |
| `vallendar-cdu.de` | `/vallendar/` |
| `cdu-urbar.de` | `/urbar/` |
| `cduweitersburg.de` | `/weitersburg/` |

Die alten Seiten werden im neuen Auftritt nicht mehr als Quellen verlinkt. Die eigentlichen Weiterleitungen müssen später beim jeweiligen Domainanbieter eingerichtet werden. Das geschieht erst zusammen mit der endgültigen Domain und nach Freigabe des gemeinsamen Auftritts.
