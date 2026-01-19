# Evoluerende Wezens Simulatie

Een interactieve evolutionaire simulatie waarin wezens evolueren door natuurlijke selectie, gevechten en verhongering.

## Wat doet deze app?

Deze applicatie simuleert een evolutionair ecosysteem waarin wezens:
- **Evolueren** door natuurlijke selectie over generaties
- **Bewegen** met fysieke lichamen, gewrichten en motoren
- **Waarnemen** met sensoren (ogen en voelsprieten)
- **Vechten** met elkaar door botsingen en aanvallen
- **Overleven** door voedsel te verzamelen en gezond te blijven
- **Vermenigvuldigen** waarbij de beste wezens hun DNA doorgeven

## Regels van de Simulatie

### Voedsel en Gezondheid

Elk wezen heeft twee aparte bars:

1. **Voedsel Bar (oranje/geel)**
   - Daalt langzaam over tijd (precies 1 uur om van 100 naar 0 te gaan)
   - Kan worden aangevuld door power-ups te verzamelen
   - **Als de voedsel bar leeg is, sterft het wezen door verhongering**

2. **Gezondheid Bar (rood-groen)**
   - Daalt alleen door gevechten met andere wezens
   - Kan worden aangevuld door power-ups te verzamelen
   - **Als de gezondheid bar leeg is, sterft het wezen**

### Doodsoorzaken

Wezens kunnen op drie manieren sterven:

1. **Verhongering**: Wanneer de voedsel bar op 0 komt
2. **Gevecht**: Wanneer de gezondheid bar op 0 komt door schade
3. **Mond-hart aanval**: Wanneer een wezen met zijn mond dichtbij het hart van een ander wezen komt (instant kill)

### Generaties

- **Nieuwe generatie start** wanneer er nog maar 2 wezens over zijn (niet op basis van tijd)
- De **beste 2 wezens** uit de vorige generatie worden behouden (elitisme)
  - Elite wezens blijven op het scherm staan en behouden hun leeftijd
  - Hun leeftijd loopt door terwijl nieuwe wezens worden toegevoegd
- De rest van de populatie wordt gegenereerd door:
  - **Seksuele reproductie**: Crossover tussen twee ouders
  - **Aseksuele reproductie**: Klonen met mutatie
  - **Mutatie**: Kleine willekeurige veranderingen in DNA

### Voortplanting Tijdens Generatie

- Wezens kunnen zich **voortplanten tijdens een generatie** (niet alleen tussen generaties)
- **Voorwaarden voor voortplanting:**
  - Beide wezens moeten minimaal 30 seconden oud zijn
  - Beide wezens moeten minimaal 50 food en 50 health hebben
  - Wezens moeten binnen 80 pixels afstand van elkaar zijn
  - Cooldown van 60 seconden tussen voortplantingen
- **Nieuwe wezens** worden gespawnd met DNA gebaseerd op crossover van beide ouders
- **Maximale populatie**: 100 wezens (om overbevolking te voorkomen)

### Beweging en Energie

- Wezens krijgen **geen voedsel** meer door te bewegen
- Wezens moeten **power-ups verzamelen** om te overleven
- Beweging kost geen energie meer (geen stun effect)

### Gevechten en Leeftijd

- **Leeftijdsgebaseerd gevechtssysteem**: Oudere wezens hebben een voordeel in gevechten
- **Aanvalsbonus**: Lineair van 1.0x (leeftijd 0) tot 2.0x (leeftijd 4 uur)
- **Verdedigingsbonus**: Lineair van 100% schade (leeftijd 0) tot 50% schade (leeftijd 4 uur)
- **Kill bonus**: Wanneer een wezen een ander doodt, krijgt het **volledige health (200) en food (200)**

### Tijd

- De tijd telt **continu door** over alle generaties heen
- Tijd wordt weergegeven met maanden, weken, dagen, uren, minuten en seconden
- De simulatie kan tot **1000x snelheid** draaien
- De simulatie **blijft doorgaan op de achtergrond** wanneer je naar een andere tab gaat

## Features

### Event Log

Een verplaatsbaar en minimaliseerbaar venster toont real-time gebeurtenissen:

- **Geboorte** (groen): Wanneer een nieuw wezen wordt geboren (bij generatie start of voortplanting)
- **Verhongering** (oranje): Wanneer een wezen verhongert
- **Moord** (rood): Wanneer een wezen een ander vermoordt
- **Schade** (blauw): Wanneer een wezen schade toebrengt aan een ander

### Statistieken

De sidebar toont:
- Huidige generatie nummer
- Totale simulatie tijd
- Aantal levende wezens
- Beste en gemiddelde fitness
- **Oudste wezen**: ID en leeftijd van het oudste levende wezen

### Visuele Indicatoren

- **Voedsel bar**: Oranje/gele bar boven elk wezen
- **Gezondheid bar**: Rood-groene bar boven elk wezen
- **Gouden kroon**: Boven het oudste wezen
- **Beauty glow**: Gele gloed rond mooie wezens (beauty > 0.7)

### Wezen Details

Klik op een wezen om details te zien:
- Voedsel en gezondheid levels
- Leeftijd
- Aantal lichaamsdelen, sensoren, ledematen
- Sensor bereik
- Aantal grijpers
- Geheugen grootte

## Technische Details

### DNA Structuur

Elk wezen heeft DNA dat bepaalt:
- **Morfologie**: Aantal en vorm van lichaamsdelen (cirkels of rechthoeken)
- **Gewrichten**: Verbindingen tussen lichaamsdelen met motorpatronen
- **Sensoren**: Ogen en voelsprieten voor waarneming
- **Kleuren**: Visuele variatie
- **Beauty**: Aantrekkelijkheid waarde (0-1)

### Evolutie Mechanisme

- **Elitisme**: Top 2 wezens worden ongewijzigd behouden
- **Tournament Selection**: Ouders worden geselecteerd op basis van fitness
- **Crossover Rate**: 30% kans op seksuele reproductie
- **Mutation Rate**: 15% kans op mutatie per eigenschap
- **Fitness**: Gebaseerd op afstand, kills, schade toegebracht en schade ontvangen

### Physics

- Gebruikt Matter.js voor realistische fysica
- Geen zwaartekracht (top-down view)
- Obstakels en grenzen
- Collision detection voor gevechten
- Automatische cleanup van verwijderde wezens

## Besturing

- **Start/Pauze**: Start of pauzeer de simulatie
- **Reset**: Begin opnieuw met generatie 0
- **Snelheid**: Pas de simulatiesnelheid aan (0.5x - 1000x)
- **Populatie**: Pas de populatiegrootte aan (5-50 wezens)
- **Export/Import**: Exporteer het beste DNA of importeer DNA uit een bestand

## Installatie

1. Clone de repository:
```bash
git clone https://github.com/aderijke/Evolution.git
cd Evolution
```

2. Open `index.html` in een moderne webbrowser

3. De app gebruikt externe libraries:
   - PixiJS (voor WebGL rendering)
   - Matter.js (voor physics)

Deze worden automatisch geladen via CDN.

## Browser Vereisten

- Moderne browser met WebGL ondersteuning
- JavaScript ingeschakeld
- Aanbevolen: Chrome, Firefox, Safari of Edge (laatste versies)

## Licentie

Dit project is open source en beschikbaar voor educatieve doeleinden.
