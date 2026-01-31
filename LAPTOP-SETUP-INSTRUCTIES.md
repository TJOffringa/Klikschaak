# 🚀 Klikschaak - Setup Instructies (LAPTOP)

**Datum:** 28 januari 2026  
**Status:** Klaar om te deployen!

## ✅ Wat Je Al Hebt

Deze bestanden heb je van de telefoon gedownload:
- `klikschaak.html` - Werkende game met favicons
- `README.md` - Complete documentatie  
- `LICENSE` - CC BY-NC-SA 4.0
- `BRAND-ASSETS.md` - Assets instructies
- `LAPTOP-SETUP-INSTRUCTIES.md` - Dit document
- **Essential favicons:**
  - `favicon-32x32.png` - Browser tab icon (most important!)
  - `favicon-192x192.png` - Android home screen
  - `apple-touch-icon-180x180.png` - iOS home screen
- `logo-200x200.png` - General purpose logo
- `social-preview-1200x630.png` - Social media preview

## 📋 STAP 1: Git Installeren (Als Niet Aanwezig)

### Check of je Git hebt:
1. Open PowerShell (Windows key + R → typ `powershell` → Enter)
2. Typ: `git --version`

**Als je een versienummer ziet (bijv. "git version 2.43.0"):**
→ Git is geïnstalleerd! Ga door naar STAP 2

**Als je een error ziet:**
→ Download Git: https://git-scm.com/download/win
→ Installeer met standaard instellingen
→ Herstart PowerShell
→ Check opnieuw: `git --version`

## 📋 STAP 2: Git Configureren (Eenmalig)

Open PowerShell en typ deze 2 commands (vervang met je eigen info):

```powershell
git config --global user.name "Tjaart Offringa"
git config --global user.email "jouw-github-email@example.com"
```

**Let op:** Email moet hetzelfde zijn als je GitHub account!

Check of het gelukt is:
```powershell
git config --list
```

## 📋 STAP 3: Bestanden Organiseren

1. Maak een folder: `C:\Users\[JouwNaam]\Documents\Klikschaak`
2. Zet ALLE gedownloade bestanden in deze folder
3. Check dat je hebt:
   - ✅ klikschaak.html
   - ✅ README.md
   - ✅ LICENSE
   - ✅ BRAND-ASSETS.md
   - ✅ LAPTOP-SETUP-INSTRUCTIES.md
   - ✅ favicon-32x32.png
   - ✅ favicon-192x192.png
   - ✅ apple-touch-icon-180x180.png
   - ✅ logo-200x200.png
   - ✅ social-preview-1200x630.png

## 📋 STAP 4: GitHub Personal Access Token Maken

**Waarom?** GitHub gebruikt tokens i.p.v. wachtwoorden voor beveiliging.

1. Ga naar: https://github.com/settings/tokens
2. Click: "Generate new token" → "Generate new token (classic)"
3. Note: "Klikschaak Laptop"
4. Expiration: "90 days" (of langer)
5. Check: ✅ `repo` (dit geeft toegang tot je repositories)
6. Scroll naar beneden → Click: "Generate token"
7. **BELANGRIJK:** Kopieer de token (begint met `ghp_...`)
8. Bewaar in Notepad of password manager - je ziet het maar 1x!

## 📋 STAP 5: Upload naar GitHub

Open PowerShell en volg deze stappen EXACT:

```powershell
# 1. Ga naar je Klikschaak folder
cd C:\Users\[JouwNaam]\Documents\Klikschaak

# 2. Initialiseer Git in deze folder
git init

# 3. Voeg je GitHub repository toe als "origin"
git remote add origin https://github.com/TJOffringa/Klikschaak.git

# 4. Check welke bestanden er zijn
git status

# Je zou alle bestanden in ROOD moeten zien

# 5. Voeg ALLE bestanden toe
git add .

# 6. Check status opnieuw
git status

# Nu zijn alle bestanden GROEN - klaar om te uploaden!

# 7. Commit (opslaan) met een bericht
git commit -m "Add complete Klikschaak v1.0 with favicons and meta tags"

# 8. Upload naar GitHub (eerste keer)
git push -u origin main
```

**Bij stap 8 vraagt Git om authenticatie:**
- Username: `TJOffringa` (je GitHub username)
- Password: **PLAK JE TOKEN HIER** (niet je normale wachtwoord!)

**Na eerste keer:** Volgende keer kun je gewoon `git push` typen!

## ✅ Verificatie

1. Ga naar: https://github.com/TJOffringa/Klikschaak
2. Refresh de pagina
3. Je zou ALLE bestanden moeten zien!

## 🌐 GitHub Pages Check

1. Wacht 1-2 minuten (GitHub Pages update tijd)
2. Ga naar: https://tjoffringa.github.io/Klikschaak/klikschaak.html
3. Je game staat live! 🎉
4. Check de browser tab - favicon zou moeten verschijnen!

## 📱 GitHub Social Preview Instellen

1. Ga naar: https://github.com/TJOffringa/Klikschaak/settings
2. Scroll naar "Social preview"
3. Click "Edit"
4. Upload: `social-preview-1200x630.png`
5. Save

Nu ziet je repository er professioneel uit bij shares!

## 🎯 STAP 6: Klaar Voor Multiplayer Development!

**Nu kun je beginnen met Week 1:**

### VS Code Installeren
1. Download: https://code.visualstudio.com/
2. Installeer (standaard instellingen)

### Claude Code Gebruiken
1. Open VS Code
2. Open je Klikschaak folder: File → Open Folder → Selecteer `C:\Users\[JouwNaam]\Documents\Klikschaak`
3. Open terminal in VS Code: `Ctrl + ~` (tilde toets)
4. Type: `claude`
5. Zeg: "Lees README.md en klikschaak.html. Begin met Week 1 van de roadmap: refactoring naar TypeScript modules."

Claude Code zal dan:
- ✅ HTML splitsen in modules
- ✅ TypeScript setup
- ✅ i18n systeem (Engels)
- ✅ Vite bundler
- ✅ Alles testen
- ✅ Commits maken

## 🆘 Problemen?

### "fatal: not a git repository"
```powershell
# Je bent waarschijnlijk niet in de goede folder
cd C:\Users\[JouwNaam]\Documents\Klikschaak
git init
```

### "Authentication failed"
- Check of je token correct gekopieerd is
- Token moet `ghp_` beginnen
- Maak nieuwe token als nodig

### "Your branch is behind"
```powershell
git pull origin main --allow-unrelated-histories
git push origin main
```

### Bestanden ontbreken op GitHub
```powershell
# Check wat er niet geupload is
git status

# Voeg toe en push opnieuw
git add .
git commit -m "Add missing files"
git push
```

## 📧 Notities

- GitHub repository: https://github.com/TJOffringa/Klikschaak
- Live site: https://tjoffringa.github.io/Klikschaak/klikschaak.html
- Token bewaren in password manager!
- Backup van token maken (je ziet hem maar 1x)

## ✅ Checklist

Vink af wat je gedaan hebt:

- [ ] Git geïnstalleerd (`git --version` werkt)
- [ ] Git geconfigureerd (naam + email)
- [ ] Bestanden in folder gezet
- [ ] GitHub token gemaakt en bewaard
- [ ] `git init` in folder
- [ ] `git remote add origin` uitgevoerd
- [ ] `git add .` uitgevoerd
- [ ] `git commit -m "..."` uitgevoerd
- [ ] `git push -u origin main` uitgevoerd (met token)
- [ ] GitHub repository checked (bestanden staan erop)
- [ ] GitHub Pages werkt (live site checked)
- [ ] Social preview ingesteld
- [ ] VS Code geïnstalleerd
- [ ] Klaar voor multiplayer development!

---

**Succes! Bij problemen: open GitHub Issue**
https://github.com/TJOffringa/Klikschaak/issues
