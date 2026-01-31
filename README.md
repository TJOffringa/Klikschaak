# Klikschaak - Interactive Chess Variant

Een innovatieve schaakvariant waar spelers stukken kunnen "klikken" (combineren) op hetzelfde veld voor strategische voordelen.

## 📋 Huidige Status

**Versie:** v1.0-stable  
**Bestandsgrootte:** 1368 regels HTML/CSS/JavaScript  
**Platform:** Web-based, volledig mobiel geoptimaliseerd  
**Laatst bijgewerkt:** 26 januari 2026  

✅ **Alle functionaliteit werkt perfect - 100% productie-klaar!**

## 🎮 Spelregels Samenvatting

### Kernmechanisme: Klikken
- Maximaal 2 stukken van dezelfde kleur kunnen op 1 veld
- Geklikte stukken bewegen als één eenheid met eigenschappen van beide
- Stukken kunnen altijd "ontklikken" (één stuk apart bewegen)
- Als geklikt stuk geslagen wordt, gaan beide stukken de doos in

### Belangrijke Regels
1. **Koning mag NOOIT klikken** (fundamenteel voor mat-mogelijkheden)
2. **Promotie alleen met pionzet** - pion kan niet door ander stuk naar achtste rij
3. **Unklik-promotie**: alleen pion promoveert, ander stuk blijft achter
4. **Geklikte promotie**: pion promoveert, ander stuk komt mee
5. **Rokade met klik**: uitgebreide regels voor geklikte torens (zie hieronder)
6. **En passant**: strikte regels (zie hieronder)
7. **Pion klik**: alleen recht vooruit, niet diagonaal
8. **Pion achterste rij**: pion mag nooit naar eigen achterste rij

## 📚 Uitgebreide Spelregels

### 1. Klikken (Combineren)

**Wanneer mag je klikken?**
- Je selecteert een stuk dat alleen staat (niet geklikt)
- Er staat precies 1 eigen stuk op het doelveld
- Het doelveld heeft GEEN koning
- Je eigen stuk is GEEN koning
- **Speciale regel pion**: alleen recht vooruit klikken (niet diagonaal)

**Wat gebeurt er?**
- Beide stukken komen op hetzelfde veld
- Ze bewegen vanaf nu samen als eenheid
- Ze krijgen de bewegingsmogelijkheden van BEIDE stukken

**Voorbeelden:**
- ♖ + ♘ = Toren+Paard: kan bewegen als toren OF als paard
- ♕ + ♙ = Dame+Pion: kan als dame OF pion (inclusief en passant!)
- ♗ + ♗ = Loper+Loper: beide lopers tegelijk (veel diagonalen!)

**Visuele indicator:** Blauwe ring om doelveld

### 2. Ontklikken (Splitsen)

**Wanneer mag je ontklikken?**
- Je selecteert een geklikt stuk (2 stukken op 1 veld)
- Je klikt op één van de driehoeken (links of rechts)
- Je kiest welk stuk je wilt loskoppelen

**Wat gebeurt er?**
- Geselecteerd stuk kan individueel bewegen
- Ander stuk blijft achter op originele veld
- Je kunt ook ontklikken EN meteen klikken met ander stuk (unklik-klik)

**Strategisch gebruik:**
- Verdediging: splits stukken voor betere dekking
- Aanval: gebruik beide stukken apart voor dubbele dreiging
- Promotie: alleen de pion promoveert, ander stuk blijft achter

**Visuele indicator:** Paarse ring om doelveld (unklik-klik)

### 3. Promotie Scenario's

#### Scenario A: Normale Pion Promotie
```
♙ e7-e8 → Kies: ♕ ♖ ♗ ♘
Simpel: pion bereikt achtste rij, kies promotiestuk
```

#### Scenario B: Unklik Promotie
```
♖♙ op e7 (geklikt)
Pion ontklikken en naar e8:
→ Pion promoveert tot ♕
→ Toren blijft op e7
```

#### Scenario C: Geklikte Promotie
```
♖♙ op e7 (geklikt)
Beiden bewegen naar e8:
→ Pion promoveert tot ♕
→ Toren komt MEE: ♖♕ op e8
```

**Kritieke regel:** Pion kan NIET door ander stuk naar achtste rij gebracht worden!
```
❌ ♖♙ op e7, TOREN beweegt naar e8 → NIET TOEGESTAAN
✅ ♖♙ op e7, PION beweegt naar e8 → Promotie!
```

### 4. Rokade met Geklikte Toren

**Basisregel:** Toren mag geklikt zijn en toch rokeren (als toren niet bewogen is)

#### Situatie 1: Toren alleen (normale rokade)
```
♔ e1, ♖ h1 → O-O
Koning naar g1, toren naar f1
```

#### Situatie 2: Toren geklikt, f1 leeg
```
♔ e1, ♖♘ h1 (geklikt) → KEUZE-DIALOOG
Optie A: Alleen toren rokeren (♘ blijft op h1)
Optie B: Beide stukken rokeren (♖♘ naar f1)
```

#### Situatie 3: Toren geklikt, f1 heeft stuk
```
♔ e1, ♖♘ h1 (geklikt), ♗ f1
→ Toren ontklikken en klikken met ♗
→ Resultaat: ♘ op h1, ♖♗ op f1
```

#### Situatie 4: Toren alleen, f1 heeft stuk
```
♔ e1, ♖ h1, ♗ f1
→ Toren klikt met ♗ op f1
→ Resultaat: ♖♗ op f1
```

**Visuele indicator:** Keuze-dialoog bij scenario 2

### 5. En Passant (Strikte Regels!)

**6 Voorwaarden (ALLE moeten waar zijn):**

1. ✅ **Bewegend stuk bevat een pion**
   - Pure pion OF geklikte pion (bijv. ♖♙)

2. ✅ **Recht vooruit bewegen**
   - fromCol === toCol (geen diagonaal!)

3. ✅ **Vanaf startrij**
   - Wit: rij 2 (6 in array)
   - Zwart: rij 7 (1 in array)

4. ✅ **GEEN slagzet**
   - Bij slag deed het andere stuk de move!
   - Voorbeeld: ♖♙ a7xa5 → Toren sloeg, GEEN en passant

5. ✅ **2 velden vooruit**
   - Dubbele pionzet

6. ✅ **Pion heeft nooit bewogen**
   - Tracked via unieke pion IDs (P0-P7, p0-p7)
   - Pion die via klikken terugkomt: mag NIET opnieuw 2 vooruit

**Voorbeelden:**

✅ **JA - En passant mogelijk:**
```
♙ e2-e4 (pion, recht, vanaf start, geen slag, 2 velden, nooit bewogen)
→ Zwart pion op d4 of f4 kan e.p. slaan
```

✅ **JA - Met geklikte pion:**
```
♖♙ e2-e4 (PION deed zet, recht, vanaf start, geen slag, 2 velden, nooit bewogen)
→ En passant mogelijk!
```

❌ **NEE - Slagzet:**
```
♖♙ a7xa5 (TOREN deed zet, want slagzet)
→ GEEN en passant mogelijk
```

❌ **NEE - Diagonaal:**
```
♘♙ e2-d4 (PAARD deed zet, niet recht vooruit)
→ GEEN en passant mogelijk
```

❌ **NEE - Al bewogen:**
```
♙ e2-e3 eerder, later terugklikken naar e2, nu e2-e4
→ GEEN en passant (pion al bewogen)
```

**Keuze-dialoog bij conflict:**
```
♕♙ op c5, zwart speelt b7-b5
Dame KAN naar b6, Pion KAN e.p. naar b6
→ KEUZE: En passant (pion slaat) OF Normale zet (dame beweegt)
```

### 6. Pion Speciale Regels

#### Pion Klikken
**Alleen recht vooruit:**
```
✅ ♙ e2, ♘ e3 → ♙ kan klikken met ♘
✅ ♙ e2, ♘ e4 → ♙ kan klikken als e3 leeg (dubbele zet)
❌ ♙ e2, ♘ d3 → Kan NIET (diagonaal)
```

#### Pion Achterste Rij
**Mag nooit naar eigen achterste rij:**
```
❌ Witte pion (♙) naar rij 1 → GEBLOKKEERD
❌ Zwarte pion (♟) naar rij 8 → GEBLOKKEERD
```
**Waarom:** Pion kan alleen vooruit, achterste rij is onmogelijk

#### Pion Tracking Systeem
**Elke pion heeft uniek ID:**
```
Start: P0 (a2), P1 (b2), ..., P7 (h2)  [wit]
       p0 (a7), p1 (b7), ..., p7 (h7)  [zwart]

P2 beweegt c2-c4 → P2 gemarkeerd als "bewogen"
P4 klikt en gaat naar c-lijn → Blijft P4!
P2 kan NIET meer dubbele zet, maar P4 WEL (als op startrij)
```

### 7. Schaak, Mat & Pat

#### Schaak
- Koning staat onder aanval
- Moet ontsnappen, blokkeren of aanvaller slaan
- **Visuele indicator:** Rode "SCHAAK!" box (3 seconden)

#### Schaakmat
- Koning staat schaak
- GEEN legale zet om schaak te ontlopen
- **Winnaar:** Tegenstander
- **Game over overlay:** "Schaakmat! [Kleur] wint!"

#### Pat
- Speler heeft GEEN legale zetten
- Koning staat NIET schaak
- **Resultaat:** Remise (gelijkspel)
- **Game over overlay:** "Pat! Remise"

### 8. Strategische Concepten

#### Materiaal Voordeel
```
Dame (♕): 9 punten
Toren (♖): 5 punten
Loper (♗): 3 punten
Paard (♘): 3 punten
Pion (♙): 1 punt

Geklikte stukken = Som van beide!
♖♘ = 5+3 = 8 punten (bijna een dame)
♕♙ = 9+1 = 10 punten (super sterk!)
```

#### Klik Strategie
**Offensief:**
- Combineer dame + stuk voor super-aanval
- Dubbelgevaar met geklikte torens
- Pion + stuk naar promotieveld

**Defensief:**
- Klik stukken voor betere dekking
- Unklik voor dubbele verdediging
- Tijd winnen door klikken/ontklikken

#### Timing
**Wanneer klikken?**
- ✅ Eindspel: sterke geklikte stukken beslissen
- ✅ Aanval: extra bewegingsmogelijkheden
- ⚠️ Opening: niet te vroeg (minder flexibiliteit)

**Wanneer ontklikken?**
- ✅ Verdediging: dekkingsgaten vullen
- ✅ Promotie: pion solo naar achtste rij
- ✅ Mat dreigt: splits voor counter-aanval

### Rokade Regels (Uitgebreid)
**Geklikte toren MAG rokeren** - verliest alleen rokaderecht bij verplaatsing

**Scenario 1: Toren NIET geklikt**
- f1/f8 of d1/d8 leeg → Normale rokade
- f1/f8 of d1/d8 heeft eigen stuk → Toren klikt met dat stuk

**Scenario 2: Toren WEL geklikt**
- f1/f8 of d1/d8 leeg → **KEUZE**: alleen toren OF beide stukken
- f1/f8 or d1/d8 heeft eigen stuk → Toren ontklikken, klik met stuk op doelveld

### En Passant Regels (Strikt!)
**En passant is ALLEEN mogelijk wanneer:**
1. ✅ Een pion (al dan niet geklikt) beweegt
2. ✅ Recht vooruit (fromCol === toCol)
3. ✅ Vanaf startrij (rij 2 wit, rij 7 zwart)
4. ✅ **GEEN slagzet** (bij slag deed ander stuk de move)
5. ✅ 2 velden vooruit
6. ✅ Pion heeft nog **nooit** bewogen

**Voorbeelden:**
- ✅ Pion e2-e4: En passant mogelijk
- ✅ Toren+Pion e2-e4: En passant mogelijk (pion doet zet)
- ❌ Toren+Pion a7xa5: GEEN en passant (slag! toren deed zet)
- ❌ Paard+Pion e2-d4: GEEN en passant (paard deed zet)
- ❌ Pion e3-e5: GEEN en passant (niet vanaf startrij)

### Pion Klik Regels  
- **Alleen recht vooruit** (niet diagonaal)
- 1 veld vooruit als daar 1 eigen stuk staat
- 2 velden vooruit vanaf startrij (als pion nooit bewogen EN tussenveld leeg EN doelveld 1 eigen stuk)

### Pion Beperkingen
- Pion mag **nooit** naar eigen achterste rij (rij 1 wit, rij 8 zwart)
- Dubbele pionzet **alleen eerste keer** - zelfs na terugkeren via klikken

## 🏗️ Huidige Implementatie

### ✅ Volledig Werkend
- Alle standaard schaakregels
- Klik mechanisme (max 2 per veld)
- Unklik mechanisme
- Driehoek UI (volledig transparant)
- Visuele indicatoren (stippen/ringen per type)
- **Rokade met geklikte toren + keuze-dialoog**
- **En passant (strikte validatie + keuze-dialoog)**
- **Unieke pion tracking (P0-P7, p0-p7)**
- **Pion klik (alleen recht vooruit)**
- **Pion mag nooit naar eigen achterste rij**
- Promotie (3 scenario's)
- Schaak/schaakmat detectie
- Pat detectie
- **Move history (2-koloms notatie met symbolen)**
- Mobiel responsive
- Auto-promote optie

### UI Features
- Moderne gradient achtergrond
- Chess symbolen (♔♕♖♗♘♙)
- Geklikte stukken: beide symbolen gestapeld
- **Move notatie: ♙e2-e4, ♖♘h1-f3, ♙e5xd6 e.p.**
- **2-koloms move history (wit | zwart)**
- 3 keuze-dialogen (promotie, rokade, en passant)
- Game over overlay
- Schaak indicator

### Technische Details
- **1368 regels** single-file HTML
- **Vanilla JS** - geen dependencies
- **CSS** responsive design
- **Mobile-first** touch events
- **Uniek pion systeem** - P0-P7, p0-p7
- **Efficiënt** state management
- **Compleet** move validation

## 🐛 Alle Opgeloste Bugs (Sessie 26 jan 2026)

### Bug #1-11: [Eerdere bugs - zie vorige versies]

### Bug #12: Pion mag naar eigen achterste rij
**Symptoom**: Geklikte pion kon naar eigen achterste rij bewegen  
**Fix**: Check toegevoegd in getCombinedMoves en handleUnklikSelect  
**Status**: ✅ Opgelost  

### Bug #13: Pion dubbele zet na terugkeren
**Symptoom**: Pion die via klikken terug naar startrij komt mag opnieuw 2 vooruit  
**Oplossing**: `movedPawns` Set tracking systeem  
**Status**: ✅ Geïmplementeerd  

### Bug #14: isWhite identifier syntax error
**Symptoom**: Dubbele declaratie van `const isWhite` in handleUnklikSelect  
**Fix**: Tweede declaratie verwijderd  
**Status**: ✅ Opgelost  

### Bug #15: Move notatie niet professioneel
**Symptoom**: Notatie was `Pion x` in plaats van `♙e2-e4`  
**Fix**: Complete notatie overhaul:
- Van-veld + Naar-veld altijd getoond
- Chess symbolen (♙♘♗♖♕♔)
- Captures: `♙e5xd6`
- En passant: `♙e5xd6 e.p.`
- Promotie: `♙e7-e8=♕`  
**Status**: ✅ Geïmplementeerd  

### Bug #16: Move history niet overzichtelijk
**Symptoom**: Moves in enkele lijst, niet gegroepeerd  
**Fix**: 2-koloms layout (wit | zwart) zoals echte schaaknotatie  
**Status**: ✅ Geïmplementeerd  

### Bug #17: En passant na diagonale move
**Symptoom**: Paard+Pion d5-c7 triggerde en passant  
**Oorzaak**: Check alleen op 2 rijen verschil, niet op recht vooruit  
**Fix**: `fromCol === toCol` check toegevoegd  
**Status**: ✅ Opgelost  

### Bug #18: En passant niet vanaf startrij
**Symptoom**: En passant mogelijk vanaf elke rij  
**Fix**: `isFromStartRank` check toegevoegd (rij 6 wit, rij 1 zwart)  
**Status**: ✅ Opgelost  

### Bug #19: Pionnen op zelfde kolom conflict
**Symptoom**: Pion c2 kon niet 2 vooruit als andere pion op c-lijn stond  
**Oorzaak**: Pionnen geïdentificeerd als `P-2` (kolom), niet uniek  
**Oplossing**: Uniek pion systeem:
- Elke pion heeft vast ID: P0-P7 (wit), p0-p7 (zwart)
- PS en PN mappings uitgebreid
- Alle piece checks gebruiken `charAt(0).toLowerCase()`
- `movedPawns` gebruikt volledige pion ID  
**Status**: ✅ Geïmplementeerd  

### Bug #20: En passant na slagzet
**Symptoom**: Toren+Pion a7xa5 triggerde en passant (toren deed zet, niet pion)  
**Fix**: `isNotCapture` check toegevoegd - bij slag deed niet de pion de zet  
**Status**: ✅ Opgelost  

## 📁 Projectstructuur

### Huidig (Productie-klaar)
```
klikschaak/
├── README.md           # Deze documentatie
├── klikschaak.html     # 1368 regels - volledig werkend!
└── regelsklikschaak.pdf # Officiële regels
```

### Multiplayer (Toekomstig)
```
klikschaak/
├── src/
│   ├── client/
│   │   ├── game/      # Logica
│   │   ├── ui/        # Rendering
│   │   └── multiplayer/ # Netwerk
│   └── server/
│       ├── index.js
│       ├── socket-server.js
│       └── validation.js
└── tests/
```

## 🎯 Roadmap (4 weken)

**Week 1:** Refactoring
- Split in modules
- **Internationalisatie (i18n) systeem**
  - Engels vertaling
  - Taalswitch knop in UI
  - Translations object structuur
  - Basis voor meer talen (Frans, Duits, etc.)

**Week 2:** Backend - Express + Socket.io
- User authentication (JWT)
- **Invite code systeem** (gesloten beta)
- Database setup (users, games, invites)

**Week 3:** Multiplayer - real-time sync
- **Online lobby** (zie wie online is)
- Friend code systeem (speel met bekenden)
- Real-time game synchronisatie
- Spectator mode (optioneel)

**Week 4:** Polish - accounts, rating, replay
- Basic stats (wins/losses/draws)
- Game history
- Profile pages
- Bug fixes & optimization

## 🏗️ Product Roadmap & Architecture

### MVP Features (Maand 1)
**Must-Have:**
- ✅ Online multiplayer (1v1)
- ✅ **Lobby systeem** (zie online users)
- ✅ **Invite code registratie** (gesloten beta)
- ✅ Friend code sharing (speel met vriend)
- ✅ **Tijd controle systeem** (7 min standaard, meerdere opties)
- ✅ User accounts (JWT auth)
- ✅ Basic stats (W/L/D ratio)
- ✅ Game history (laatste 10 games)
- ✅ Web-first (desktop + mobile responsive)
- ✅ Volledig gratis (open source)

**Nice-to-Have:**
- 🔶 Chat tijdens game
- 🔶 Spectator mode
- 🔶 Rematch button

**Expliciet NIET in MVP:**
- ❌ AI/Bot opponent (te complex)
- ❌ Quick match / Matchmaking (later)
- ❌ ELO rating systeem (later)
- ❌ Leaderboard (later)
- ❌ Achievements (later)
- ❌ Game replay viewer (later)

### Post-MVP (Maand 2-3)
**Phase 2 Features:**
- Quick match (random opponent)
- ELO rating systeem
- Public leaderboard
- Tournament mode
- Advanced stats

**Phase 3 Features:**
- AI opponent (basic difficulty)
- **ClickTactics** (Puzzels/Oefeningen)
- Opening book / tutorials
- Mobile app (PWA/React Native)

## 🧩 ClickTactics (Toekomstige Feature)

### Concept
Puzzels en tactische oefeningen specifiek voor Klikschaak. Leer patronen, combinaties en strategie door gerichte oefeningen.

### Puzzle Categorieën

#### 1. Klik Basics (Beginner)
**Doel:** Leer fundamentele klik mechanica

**Puzzle 1.1 - Eerste Klik**
```
Positie: Wit heeft ♖ h1, ♘ h3
Opdracht: Klik de toren met het paard
Leerdoel: Basale klik mechanica
Zetten: 1. ♘h3-h1 klikt
```

**Puzzle 1.2 - Unklik Kracht**
```
Positie: Wit ♖♘ op f3, Zwart ♔ op h8, ♛ op a1
Opdracht: Mat in 1 (gebruik unklik!)
Oplossing: 1. ♖ ontklikken f3-h3# (paard blijft op f3)
Leerdoel: Unklik voor tactische dreigingen
```

**Puzzle 1.3 - Pion Klik**
```
Positie: Wit ♙ e2, ♗ e3
Opdracht: Klik de pion met de loper
Fout: ♙ e2-d3? (diagonaal mag niet!)
Correct: ♙ e2-e3 klikt
Leerdoel: Pion klikt alleen recht vooruit
```

#### 2. Combinatie Aanvallen (Intermediate)

**Puzzle 2.1 - Dame-Pion Combo**
```
Positie: Wit ♕♙ d5 (geklikt), Zwart ♔ e8, ♜ a8
Opdracht: Forceer mat in 2
Oplossing:
1. ♕♙ d5-d8+ (dame geeft schaak)
   Zwart moet: 1... ♔f7 (enige zet)
2. ♕♙ d8xa8# (pion slaat toren = mat!)
Leerdoel: Geklikte pion heeft BEIDE krachten
```

**Puzzle 2.2 - Toren-Loper Fork**
```
Positie: Wit ♖♗ e4, Zwart ♔ e8, ♛ a8
Opdracht: Win de dame
Oplossing:
1. ♖♗ e4-e8+ (schaak via toren)
   Zwart: 1... ♔d7 of ♔f7
2. ♖♗ e8xa8 (loper slaat dame)
Leerdoel: Geklikte stukken geven dubbele dreigingen
```

**Puzzle 2.3 - Unklik-Klik Tactiek**
```
Positie: Wit ♖♘ g3, ♗ h1, Zwart ♔ h8
Opdracht: Mat in 1
Oplossing: 1. ♖ ontklikken g3-h3+ en klikt met ♗#
Leerdoel: Unklik-klik in één zet
```

#### 3. Promotie Tactieken (Advanced)

**Puzzle 3.1 - Geklikte Promotie**
```
Positie: Wit ♖♙ e7, Zwart ♔ g8, ♞ d8
Opdracht: Forceer mat
Oplossing:
1. ♖♙ e7-e8=♕ (pion promoveert, toren komt mee)
   Nu ♖♕ op e8 = mat! (dame + toren dekken alles)
Leerdoel: Geklikte promotie is zeer sterk
```

**Puzzle 3.2 - Unklik Promotie Tactiek**
```
Positie: Wit ♖♙ e7, Zwart ♔ e8, ♛ h1
Opdracht: Promoveer veilig
Fout: 1. ♖♙ e7-e8=♕? ♛h1xe8 (dame slaat!)
Correct: 1. ♙ ontklikken e7-e8=♕ (♖ blijft e7)
         Nu ♖ verdedigt nieuwe dame!
Leerdoel: Soms is unklik-promotie veiliger
```

**Puzzle 3.3 - Blokkade Doorbreken**
```
Positie: Wit ♙ e7, ♗ d6, Zwart ♔ e8 (blokkeert)
Opdracht: Promoveer de pion
Oplossing:
1. ♙ e7-e6! (gaat terug!)
2. ♙ e6-d6 klikt (met loper)
3. ♗♙ d6-d8 (loper gaat om koning heen)
4. ♙ ontklikken d8-c8=♕
Leerdoel: Creatief gebruik van klik om blokkades te omzeilen
```

#### 4. En Passant Tactieken (Expert)

**Puzzle 4.1 - En Passant Keuze**
```
Positie: Wit ♕♙ c5, Zwart b7, ♔ a8
Zwart speelt: b7-b5
Opdracht: Beste zet?
Optie A: En passant (pion slaat b6)
Optie B: Normale zet (dame naar b6)
Analyse: Beide geven schaak, maar:
- En passant: Zwart pion weg, maar dame verder van koning
- Normaal: Dame op b6 = betere aanval
Correct: Optie B (tactisch sterker)
Leerdoel: Kies slim tussen opties
```

**Puzzle 4.2 - En Passant Verdediging**
```
Positie: Wit ♙ d2, Zwart ♜♟ e4 (geklikt)
Opdracht: Beste verdediging?
Fout: 1. d2-d4?? ♜♟ e4xd3 e.p. (slaat!)
Correct: 1. d2-d3 (voorzichtig)
Leerdoel: Geklikte pionnen kunnen nog steeds e.p. slaan!
```

#### 5. Eindspel Meesterschap (Master)

**Puzzle 5.1 - Koning Oposititie**
```
Positie: Wit ♔ e4, ♙ e3, Zwart ♚ e6
Opdracht: Win
Oplossing:
1. ♙ e3-e4 klikt (met koning!)
2. ♔♙ e4-e5 (koning + pion samen vooruit)
3. ♙ ontklikken e5-e6 (pion alleen verder)
4. e6-e7-e8=♕
Leerdoel: Koning-pion combinatie in eindspel
```

**Puzzle 5.2 - Loper-Pion Eindspel**
```
Positie: Wit ♗ f6, ♙ h5, Zwart ♚ h8
Opdracht: Win zonder pat
Slecht: 1. ♙ h5-h6? stalemate!
Correct:
1. ♙ h5-f6 klikt (met loper!)
2. ♗♙ f6-g7+ (schaak via loper)
3. ♙ ontklikken g7-h7 (promotie!)
Leerdoel: Klik voorkomt pat
```

**Puzzle 5.3 - Dubbel Geklikte Verdediging**
```
Positie: Wit ♖♘ d4, ♗♙ f4, Zwart ♛♜ e5 (geklikt)
Opdracht: Verdedig tegen dubbeldreiging
Oplossing:
1. ♖♘ d4-e4 (blokkeert dame)
2. ♗♙ f4-e4 klikt (3 stukken op e4!)
   Nu alle 3 stukken beschermd!
Leerdoel: Klik kan defensief extreem sterk zijn
```

### Puzzle Moeilijkheidsgraden

**★☆☆☆☆ Beginner (1-50)**
- Basic klik/unklik mechanica
- Simpele tactieken
- 1-2 zetten oplossingen

**★★☆☆☆ Intermediate (51-100)**
- Combinaties
- 2-4 zetten oplossingen
- Basis strategie

**★★★☆☆ Advanced (101-200)**
- Promotie tactieken
- En passant situaties
- 3-6 zetten oplossingen

**★★★★☆ Expert (201-300)**
- Complexe combinaties
- Meerdere klik/unklik sequences
- 5-10 zetten

**★★★★★ Master (301+)**
- Eindspel meesterschap
- Creatieve oplossingen
- 10+ zetten, meerdere varianten

### ClickTactics Implementatie (Toekomst)

```javascript
// Puzzle data structuur
{
  id: "ct-001",
  title: "Eerste Klik",
  category: "basics",
  difficulty: 1,
  fen: "8/8/8/8/8/7N/8/7R w - - 0 1", // Starting position
  solution: ["Nh3-h1"], // Required moves
  hints: [
    "Kijk naar de toren en het paard",
    "Ze kunnen op hetzelfde veld komen",
    "Beweeg het paard naar h1"
  ],
  explanation: "Door het paard naar h1 te bewegen, klik je het met de toren. Nu kunnen ze samen bewegen!",
  points: 10,
  tags: ["klik", "basics", "mechanica"]
}
```

### Progression Systeem

**XP & Levels:**
- Puzzle opgelost = 10-100 XP (afhankelijk van difficulty)
- Level up elke 1000 XP
- Unlock nieuwe categorieën bij levels

**Achievements:**
- 🏆 "First Click" - Los eerste puzzle op
- 🏆 "Combo Master" - 10 combinatie puzzels
- 🏆 "En Passant Expert" - Alle e.p. puzzels
- 🏆 "Endgame Wizard" - Alle eindspel puzzels
- 🏆 "Perfect Streak" - 10 puzzels op rij zonder hints

**Leaderboard:**
- Snelste oplossingen
- Meeste puzzels opgelost
- Hoogste accuracy (zonder hints)



### Architecture Decisions

#### Authentication Flow
```
1. User bezoekt site
2. Heeft invite code? → Registreer
3. Login met email/password
4. JWT token opgeslagen (localStorage)
5. Token meegestuurd bij Socket.io connectie
```

#### Invite Code Systeem
```javascript
// Invite codes voor gesloten beta
{
  code: "KLIK-BETA-2026-A1B2",
  maxUses: 5,
  usedCount: 0,
  createdBy: "admin",
  expiresAt: "2026-03-01"
}

// Bij registratie:
- Check invite code geldig
- Increment usedCount
- Create user account
```

#### Lobby Systeem
```javascript
// Lobby state (Socket.io)
{
  onlineUsers: [
    { id: "user123", username: "Tjaart", rating: 1200, status: "available" },
    { id: "user456", username: "Anna", rating: 1350, status: "in-game" }
  ],
  openGames: [
    { id: "game789", host: "Tjaart", waitingFor: "opponent" }
  ]
}

// User acties:
- "Create Game" → Host game, wacht in lobby
- "Join Game" → Join open game
- "Invite Friend" → Deel friend code
```

#### Game Flow
```
1. User A creates game → kiest tijdcontrole → krijgt game code
2. User A deelt code met User B
3. User B joined met code
4. Game start → klokken beginnen
5. Real-time synchronisatie via Socket.io (moves + tijd)
6. Tijd loopt op → speler verliest bij 0:00
7. Game eindigt → stats worden opgeslagen
8. Optie: Rematch (zelfde players, zelfde tijd)
```

#### Tijd Controle Systeem

**Standaard:** 7 minuten per speler (officiële Klikschaak tijd)

**Beschikbare Tijd Opties:**
```javascript
const timeControls = [
  { id: "bullet",    name: "Bullet",     time: 60,   increment: 0   }, // 1 min
  { id: "bullet2",   name: "Bullet",     time: 120,  increment: 1   }, // 2|1
  { id: "blitz3",    name: "Blitz",      time: 180,  increment: 0   }, // 3 min
  { id: "blitz5",    name: "Blitz",      time: 300,  increment: 0   }, // 5 min
  { id: "standard",  name: "Standard",   time: 420,  increment: 0   }, // 7 min ⭐ DEFAULT
  { id: "rapid10",   name: "Rapid",      time: 600,  increment: 0   }, // 10 min
  { id: "rapid15",   name: "Rapid",      time: 900,  increment: 0   }, // 15 min
  { id: "classical", name: "Classical",  time: 1800, increment: 0   }, // 30 min
  { id: "custom",    name: "Custom",     time: null, increment: null }  // User defined
];
```

**Increment Opties (Fischer):**
- 0 sec (geen increment)
- +1 sec per zet
- +2 sec per zet
- +5 sec per zet

**UI voor Game Creation:**
```
┌─────────────────────────────┐
│  Create Game                │
│                             │
│  Time Control:              │
│  ○ 1 min (Bullet)          │
│  ○ 3 min (Blitz)           │
│  ● 7 min (Standard) ⭐      │
│  ○ 10 min (Rapid)          │
│  ○ 15 min (Rapid)          │
│  ○ 30 min (Classical)      │
│  ○ Custom                   │
│                             │
│  Increment: [0] seconds    │
│                             │
│  [Create Game]             │
└─────────────────────────────┘
```

**Timer Display (In-Game):**
```
┌─────────────────┐
│  ⚫ BLACK        │
│    5:42         │  ← Actieve speler (tikt)
├─────────────────┤
│   [BOARD]       │
├─────────────────┤
│  ⚪ WHITE        │
│    6:15         │  ← Wachtende speler
└─────────────────┘
```

**Timer Logica:**
```javascript
// Server-side timer management
class GameTimer {
  constructor(whiteTime, blackTime, increment) {
    this.white = { remaining: whiteTime, active: false };
    this.black = { remaining: blackTime, active: false };
    this.increment = increment;
    this.lastUpdate = Date.now();
  }
  
  startTurn(color) {
    // Stop andere klok, start deze
    this.white.active = (color === 'white');
    this.black.active = (color === 'black');
    this.lastUpdate = Date.now();
    
    // Sync naar clients
    this.broadcastTime();
  }
  
  endTurn(color) {
    // Stop klok, voeg increment toe
    const elapsed = Date.now() - this.lastUpdate;
    
    if (color === 'white') {
      this.white.remaining -= elapsed;
      this.white.remaining += this.increment * 1000;
      this.white.active = false;
    } else {
      this.black.remaining -= elapsed;
      this.black.remaining += this.increment * 1000;
      this.black.active = false;
    }
    
    // Check timeout
    if (this.white.remaining <= 0) return 'black-wins-timeout';
    if (this.black.remaining <= 0) return 'white-wins-timeout';
    
    return null;
  }
  
  getCurrentTime() {
    const now = Date.now();
    const elapsed = now - this.lastUpdate;
    
    return {
      white: this.white.remaining - (this.white.active ? elapsed : 0),
      black: this.black.remaining - (this.black.active ? elapsed : 0)
    };
  }
}
```

**Client-side Timer Display:**
```javascript
// Update elke 100ms voor smooth display
setInterval(() => {
  const time = game.getCurrentTime();
  updateTimerDisplay('white', formatTime(time.white));
  updateTimerDisplay('black', formatTime(time.black));
  
  // Waarschuwing bij lage tijd
  if (time.white < 10000) flashTimer('white'); // < 10 sec
  if (time.black < 10000) flashTimer('black');
}, 100);

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
```

**Socket Events:**
```javascript
// Server → Client
socket.emit('timer-update', {
  white: 420000, // ms remaining
  black: 415000,
  activeColor: 'white'
});

socket.emit('game-over', {
  reason: 'timeout',
  winner: 'black',
  finalTime: { white: 0, black: 23400 }
});

// Client → Server
socket.emit('move', {
  from: [6, 4],
  to: [4, 4],
  timestamp: Date.now() // Voor latency compensation
});
```

**Timeout Handling:**
- Speler met 0:00 verliest automatisch
- Game eindigt onmiddellijk
- Resultaat: "[Kleur] wins on time"
- Stats: count as normal win/loss

**Pause/Resume (Optioneel):**
- Beide spelers moeten akkoord gaan
- Max 2x per game per speler
- Max 5 minuten pauze
- Use case: Verbindingsproblemen

**Reconnection:**
- Client disconnect → timer blijft lopen
- 30 seconden grace period
- Daarna: speler verliest op tijd
- Bij reconnect binnen 30 sec → game gewoon verder

### Database Schema (Voorgesteld)

```javascript
// Users table
{
  id: uuid,
  username: string,
  email: string,
  passwordHash: string,
  invitedBy: uuid (invite code id),
  createdAt: timestamp,
  stats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0
  }
}

// InviteCodes table
{
  id: uuid,
  code: string (unique),
  maxUses: number,
  usedCount: number,
  createdBy: uuid,
  expiresAt: timestamp,
  active: boolean
}

// Games table
{
  id: uuid,
  whitePlayer: uuid,
  blackPlayer: uuid,
  timeControl: string, // "bullet", "blitz5", "standard", etc.
  timeWhite: number,   // Starting time in seconds
  timeBlack: number,   // Starting time in seconds
  increment: number,   // Fischer increment in seconds
  moves: json[],       // move history with timestamps
  result: string,      // "white", "black", "draw", "white-timeout", "black-timeout"
  startedAt: timestamp,
  endedAt: timestamp,
  finalTime: json      // { white: ms, black: ms }
}

// OnlineUsers (Redis/Memory)
{
  userId: uuid,
  socketId: string,
  status: "available" | "in-game" | "spectating",
  currentGame: uuid (optional)
}
```

### Tech Stack Beslissingen

**Backend:**
- Express.js (web server)
- Socket.io (real-time communication)
- PostgreSQL (persistent data: users, games, invites)
- Redis (optional: online users, sessions)
- JWT (authentication tokens)

**Deployment:**
- Railway / Render / Fly.io (backend)
- Netlify / Vercel (frontend)
- Or: Single deployment (Express serves static files)

**Waarom deze keuzes:**
- Socket.io: Industry standard voor real-time chess
- PostgreSQL: Relational data (users → games → moves)
- JWT: Stateless auth, perfect voor Socket.io
- Invite codes: Simple gesloten beta control

## 🌍 Internationalisatie (Toekomst)

### Geplande Talen
- 🇳🇱 Nederlands (huidige versie)
- 🇬🇧 Engels (Week 1)
- 🇫🇷 Frans (optioneel)
- 🇩🇪 Duits (optioneel)

### Implementatie Plan (Claude Code)
```javascript
// translations.js
const translations = {
  nl: {
    title: "Klikschaak",
    subtitle: "Combineer stukken voor strategische dominantie",
    newGame: "Nieuw Spel",
    blackToMove: "Zwart aan zet",
    whiteToMove: "Wit aan zet",
    moves: "Zetten",
    gameRules: "Spelregels",
    // ... alle UI teksten
  },
  en: {
    title: "Clickchess",
    subtitle: "Combine pieces for strategic dominance",
    newGame: "New Game",
    blackToMove: "Black to move",
    whiteToMove: "White to move",
    moves: "Moves",
    gameRules: "Game Rules",
    // ... all UI texts
  }
};

// Taalswitch UI
<div class="language-selector">
  <button onclick="setLanguage('nl')">🇳🇱</button>
  <button onclick="setLanguage('en')">🇬🇧</button>
</div>
```

### Waarom Later?
- ✅ Proper i18n tijdens refactoring (Week 1)
- ✅ Één codebase, multiple talen
- ✅ Taalswitch knop in UI
- ✅ Makkelijk uitbreiden
- ❌ Nu doen = dubbel bestand onderhoud

## 🔧 Tech Stack

**Frontend:** React/Vue/Vanilla + Vite  
**Backend:** Node.js + Express + Socket.io  
**Database:** PostgreSQL/MongoDB  
**Auth:** JWT  
**Host:** Railway/Render/Fly.io  

## 📝 Move Notatie Formaat

**Basis:** `[Symbolen][Van]-[Naar]`

**Voorbeelden:**
- `♙e2-e4` - Pion van e2 naar e4
- `♘b1-c3` - Paard van b1 naar c3
- `♖♘h1-f3` - Toren+Paard van h1 naar f3
- `♙e5xd6` - Pion slaat op d6
- `♙e5xd6 e.p.` - En passant
- `♙e7-e8=♕` - Promotie naar dame
- `O-O` - Korte rokade
- `O-O-O` - Lange rokade

## ⚠️ Kritieke Implementatie Details

### Pion Identificatie Systeem
```javascript
// Bij initialisatie:
board[6][0].pieces = ['P0']; // a2 pion
board[6][7].pieces = ['P7']; // h2 pion
board[1][0].pieces = ['p0']; // a7 pion

// Piece type check:
piece.charAt(0).toLowerCase() === 'p'

// Moved pawns tracking:
movedPawns.add('P2'); // c-pion heeft bewogen
```

### En Passant Validatie
```javascript
const conditions = {
  hasPawn: piecesToMove.some(p => p.charAt(0).toLowerCase() === 'p'),
  isStraight: fromCol === toCol,
  isFromStart: (white && fromRow === 6) || (black && fromRow === 1),
  isNotCapture: toSq.pieces.length === 0,
  isTwoSquares: Math.abs(fromRow - toRow) === 2,
  neverMoved: !movedPawns.has(pawnId)
};
// ALL must be true!
```

### Castling Rights Behoud
```javascript
// KRITIEK: gebruik piecesToMove, NIET toSq.pieces!
updateCastlingRights(fromRow, fromCol, toRow, toCol, piecesToMove);
```

## 📚 Referenties

- **Regels**: `regelsklikschaak.pdf` (© Johan Visser en Casper Rupert)
- **Website**: www.klikschaak.nl
- **Code**: `klikschaak.html` (1368 regels, productie-klaar)

## 🤝 Development Tips

1. **Lees regelsklikschaak.pdf EERST**
2. **Test edge cases**:
   - Promotie (3 scenario's)
   - Rokade (4 scenario's)
   - En passant (6 voorwaarden!)
   - Pion klik + tracking
3. **Pion systeem**: P0-P7 is essentieel
4. **En passant**: Strikte validatie
5. **Server validation**: Kritiek voor multiplayer

## 🚀 Quick Start

### Spelen
1. Open `klikschaak.html` in browser
2. Klaar! Geen installatie nodig

### Multiplayer Development (Claude Code)
```bash
cd /project

# Vraag Claude Code:
"Lees README en HTML. 
Begin Week 1: split in modules 
volgens src/ structuur."
```

## 📊 Project Stats

- **Versie**: 1.0-stable
- **Regels code**: 1368
- **Bugs opgelost**: 20
- **Dialogen**: 3 (promotie, rokade keuze, en passant keuze)
- **Unieke features**: Pion tracking, keuze-dialogen, 2-koloms notatie
- **Test coverage**: Handmatig getest op Android
- **Productie status**: ✅ Klaar!

## 🎨 Design Patterns

### Pion Tracking
- Unieke IDs bij start (P0-P7)
- Set voor moved tracking
- charAt(0) voor type checks

### Move Validation
- wouldBeInCheck voor elke move
- Separate checks per move type
- En passant: 6-staps validatie

### UI State
- selectedSquare voor piece selection
- selectedUnklikPiece voor unklik
- validMoves array voor highlights
- pendingPromotion voor async promotie

## 🏆 Productie Features

✅ Zero dependencies  
✅ Single file deployment  
✅ Mobile optimized  
✅ Professional notation  
✅ Elegant UI  
✅ Complete rule set  
✅ Robust validation  
✅ Clear visual feedback  

---

**STATUS**: ✅ 100% PRODUCTIE-KLAAR!  
**Laatst bijgewerkt**: 26 januari 2026  
**Versie**: 1.0-stable  
**Regels**: 1368  
**Bugs**: 0  
**Klaar voor**: Multiplayer development & Deployment  

🎉 **KLAAR OM TE DELEN EN TE HOSTEN!** 🎉

---

## 🚀 Quick Links

**Play Now:** https://tjoffringa.github.io/Klikschaak/klikschaak.html  
**GitHub:** https://github.com/TJOffringa/Klikschaak  
**Regels:** [regelsklikschaak.pdf](regelsklikschaak.pdf)

## 🎮 Spelen

### Online (Meest Recent)
Speel direct in je browser:
```
https://tjoffringa.github.io/Klikschaak/klikschaak.html
```

### Lokaal
Download en open `klikschaak.html` in je browser. Geen installatie nodig!

## 💻 Development Setup

### Voor Multiplayer Development

**Vereisten:**
- Node.js 18+ (https://nodejs.org/)
- VS Code (https://code.visualstudio.com/)
- Git
- Supabase account (https://supabase.com/)

**Quick Start:**
```bash
# 1. Clone repository
git clone https://github.com/TJOffringa/Klikschaak.git
cd Klikschaak

# 2. Open in VS Code
code .

# 3. Open terminal in VS Code (Ctrl + `)
# Type: claude

# 4. In Claude Code:
"Lees README.md en klikschaak.html.
Begin met Week 1: refactoring naar modules met TypeScript."
```

## 🗄️ Database Setup (Supabase)

### 1. Account & Project
```
1. Ga naar https://supabase.com/
2. Sign up (gratis tier)
3. Create new project: "klikschaak"
4. Kies regio (dichtbij Nederland: EU West)
5. Noteer: Project URL + API keys
```

### 2. Database Schema

**Users Table:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  invited_by UUID REFERENCES invite_codes(id),
  stats JSONB DEFAULT '{"gamesPlayed": 0, "wins": 0, "losses": 0, "draws": 0}'::jsonb
);

-- Index voor snelle lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

**Invite Codes Table:**
```sql
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 5,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT true
);

-- Index
CREATE INDEX idx_invite_codes_code ON invite_codes(code);

-- Check constraint
ALTER TABLE invite_codes 
ADD CONSTRAINT check_used_count 
CHECK (used_count <= max_uses);
```

**Games Table:**
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  white_player UUID REFERENCES users(id),
  black_player UUID REFERENCES users(id),
  time_control TEXT NOT NULL DEFAULT 'standard',
  time_white INTEGER NOT NULL DEFAULT 420,
  time_black INTEGER NOT NULL DEFAULT 420,
  increment INTEGER NOT NULL DEFAULT 0,
  moves JSONB DEFAULT '[]'::jsonb,
  result TEXT CHECK (result IN ('white', 'black', 'draw', 'white-timeout', 'black-timeout')),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  final_time JSONB
);

-- Indexes
CREATE INDEX idx_games_white_player ON games(white_player);
CREATE INDEX idx_games_black_player ON games(black_player);
CREATE INDEX idx_games_started_at ON games(started_at DESC);
```

### 3. Auth Setup (Supabase Dashboard)

```
1. Ga naar Authentication → Settings
2. Enable Email provider
3. Configureer email templates (optioneel)
4. Site URL: https://tjoffringa.github.io/Klikschaak/
5. Redirect URLs: 
   - http://localhost:3000 (development)
   - https://tjoffringa.github.io/Klikschaak/ (production)
```

### 4. Row Level Security (RLS)

**Users Table:**
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON users FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);
```

**Games Table:**
```sql
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Users can view games they're in
CREATE POLICY "Users can view own games"
ON games FOR SELECT
USING (auth.uid() = white_player OR auth.uid() = black_player);

-- Users can insert games they're in
CREATE POLICY "Users can create games"
ON games FOR INSERT
WITH CHECK (auth.uid() = white_player OR auth.uid() = black_player);
```

### 5. Environment Variables

**`.env` file:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

**Backend gebruik:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

## 🌐 Deployment Guide

### Current: GitHub Pages (Static)

**Status:** ✅ Live op https://tjoffringa.github.io/Klikschaak/

**Update:**
```bash
# 1. Edit klikschaak.html locally
# 2. Commit & push
git add klikschaak.html
git commit -m "Update game"
git push origin main

# 3. GitHub Pages updates automatisch (1-2 min)
```

### Future: Multiplayer Deployment

**Frontend: Netlify/Vercel**
```bash
# Gratis tier, auto-deploy from GitHub
# https://netlify.com/ or https://vercel.com/

1. Connect GitHub repo
2. Build command: npm run build
3. Publish directory: dist
4. Auto-deploys on push
```

**Backend: Railway**
```bash
# $5/maand (gratis trial beschikbaar)
# https://railway.app/

1. Connect GitHub repo
2. Add Supabase plugin (database)
3. Environment variables: Supabase keys
4. Auto-deploy on push
```

**Alternative: Render**
```bash
# Gratis tier beschikbaar
# https://render.com/

1. New Web Service
2. Connect GitHub
3. Build: npm install && npm run build
4. Start: npm start
```

### Domain Setup (Optioneel)

**Later: Custom domain**
```
1. Koop domain (bijv. klikschaak.com)
2. DNS settings:
   - CNAME: www → tjoffringa.github.io
   - A record: @ → GitHub Pages IPs
3. GitHub Settings → Pages → Custom domain
```

## 🧪 Testing

### Lokaal Testen (Current)
```
1. Open klikschaak.html in browser
2. Test alle features
3. Check console voor errors (F12)
```

### Multiplayer Testing (Future)
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev

# Open: http://localhost:3000
# Test met 2 browser windows (incognito)
```

## 📚 Referenties

- **Officiële Regels**: `regelsklikschaak.pdf` (© Johan Visser en Casper Rupert)
- **Website**: www.klikschaak.nl
- **GitHub**: https://github.com/TJOffringa/Klikschaak
- **Play Now**: https://tjoffringa.github.io/Klikschaak/klikschaak.html

## 📧 Contact

**Issues/Bugs:** https://github.com/TJOffringa/Klikschaak/issues  
**Testing:** Invite-only gesloten beta (binnenkort beschikbaar)

## 🤝 Contributing

Dit is momenteel een solo project in gesloten beta. Contributors zijn welkom na de MVP release.

**Voor testers:**
- Speel de huidige versie
- Report bugs via GitHub Issues
- Suggesties zijn welkom!

**Voor developers (later):**
- Fork het project
- Maak feature branch
- Submit pull request
- Volg de code style

## ⚖️ Licentie

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc-sa/4.0/)

**Klikschaak** is gelicenseerd onder [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](http://creativecommons.org/licenses/by-nc-sa/4.0/).

**Dit betekent:**
- ✅ Je mag het spel spelen, bestuderen en delen
- ✅ Je mag de code aanpassen en eigen versies maken
- ✅ Je mag het gebruiken voor educatieve doeleinden
- ❌ Je mag het NIET gebruiken voor commerciële doeleinden
- ❌ Je mag het NIET verkopen of er geld mee verdienen
- ✅ Afgeleide werken moeten dezelfde licentie gebruiken
- ✅ Je moet de oorspronkelijke auteur vermelden

**Copyright © 2026 Tjaart Offringa**

### Wat is "commercieel gebruik"?
Commercieel gebruik omvat, maar is niet beperkt tot:
- Het verkopen van de software of afgeleide werken
- Het plaatsen van advertenties in/bij het spel
- In-app aankopen of premium features
- Het vragen van geld om het spel te spelen
- Het gebruiken in een commercieel product

Voor commerciële licenties of vragen: open een GitHub Issue.

---

**Made with ♟️ by Tjaart Offringa**  
**Gebaseerd op Klikschaak regels van Johan Visser en Casper Rupert**
