# Anime Draft

A browser draft game. Each turn you draw a random anime character and slot them into one of 8 categories: Strength, Speed, Durability, IQ, Battle IQ, Abilities, Bum and Aura. A bot opponent drafts alongside you. When all 16 picks are made, the cards **clash** one-on-one in each category (your Strength card against theirs, and so on). The highest total power (the sum of your 8 slot ratings) wins the match. Clashes won only break an exact tie.

## Play

Online (private claude.ai link): https://claude.ai/artifact/438QPKjzTf2TK6aHy89nTK

### Game modes

Pick a **mode** and a **draft style** on the start screen.

Modes:
- **Battle**: everyone, rated on power stats (Strength, Speed, Durability, IQ, Battle IQ, Abilities, Bum, Aura).
- **Only Girls**: the same battle with a girls-only roster.
- **Beauty Contest**: rated on looks instead, with a Girls / Boys / All roster. Categories: Face, Eyes, Hair,
  Physique, Drip (outfit and style), Personality, Charm, and Red Flags (the more toxic, the more they score there).
  Ratings live in `js/looks.js`, along with the list of girls used by the girls-only rosters.

Extras:
- **Reroll**: once per match in Standard; it swaps your current draw (key R). Pool Draft has no reroll.
- **Character index** (start screen, "Characters"): every character with search and filters. Stats unlock once you've
  seen that character in a clash (battle stats in a battle, looks in a beauty contest); unlocks are remembered in your browser.
  "Unlock all" shows every stat (switch it off to go back to what you've seen).
- **Music and sound**: all synthesized in `js/audio.js` (no audio files). Separate tracks for the menu, draft, beauty
  contest and clash, sound effects for every action, and signature sounds for the big effects. Toggle music and sound
  with the buttons next to fullscreen.

- **Ban phase** (on by default, switch on the start screen): before the draft each player bans 2 characters.
  Pool Draft bans from the 30 on the table; Standard bans from the whole roster (with a search box).
- **Aizen's Kyōka Suigetsu**: if a player has Aizen, the other side sees him as a random Bum 85+ character
  (on the board, the reveal and the Pool Draft table) until his clash round, when the illusion breaks.
  The bot falls for it too. Test with `index.html#test-aizen` (opponent gets him) or `#test-aizen-you`.
- **Achievements**: 17 of them (start screen, "Achievements"), remembered in your browser.

Draft styles:
- **Standard**: each turn you draw a random character and choose their slot.
- **Pool Draft**: 30 random characters are laid out. You and the bot take turns picking one, then choose their slot.

Stats stay hidden until the clash.

### Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Controls: click a slot or press keys **1-8**. You get 15 seconds per turn. If time runs out, you get a random pick (Pool Draft) and a random open slot.

### Rebuild the online version

```
node tools/fetch-images.js --download   # saves images into images/ (git-ignored)
node tools/build-artifact.js            # bundles everything into dist/
```

Then publish `dist/` to the same artifact (see CLAUDE.md).

## Effects

Every card plays an effect when it appears, and the winner's effect plays again after each clash.

- **Signature effects**: Madara's Sharingan, Itachi's Mangekyō, Gojo's Infinite Void, Sukuna's slashes, Saitama's One Punch, Ayanokoji's White Room, Mob's ???% meter, and about 40 more. They're listed in `SPECIAL` in `js/effects.js`.
- **General effects** for everyone else, based on their best stat (if it is 80+): IQ shows floating equations, Speed shows speed lines, Strength cracks the ground, Durability adds a hex shield, Battle IQ a targeting HUD, Abilities a magic circle, and Aura flames.
- **Certified bum**: characters with a BUM rating of 85+ (Mineta, Yamcha, Megumi...) get rain and floating L's.

To preview one character's effect, open `index.html#fx=madara` (use any character id).

## Scoring

- Every character has a 1-100 rating in each stat, hidden until the clash (`js/characters.js`).
  Specialists are lopsided on purpose: Ayanokoji has 97 IQ but single digits in Abilities.
- A slot scores the character's rating in that stat.
- **BUM** is its own 1-100 rating: how much of a bum the fandom considers them. Pure garbage (Mineta 100, Yamcha 99)
  and heavily slandered "potential men" (Megumi 92, Sakura 95) both rate high, even when their other stats are decent.

## Character images

HD images come from each series' Fandom wiki (`python3 tools/fetch-hd-images.py`, saved as `images/<id>.webp`),
with AniList portraits as the fallback. On the wiki side, `wikiImage` in `js/characters.js` picks a specific file
and `noHd: true` skips characters without good HD art.

AniList images: `js/images.js` maps each character id to an AniList image URL, and the game
loads them while you play (you need an internet connection). No artwork is stored in the repo.

To refresh the list after adding characters:

```
node tools/fetch-images.js                 # look up characters that don't have a URL yet
node tools/fetch-images.js --only gojo     # re-check specific ones (add --force to replace)
node tools/fetch-images.js --download      # also save the files into images/ for offline play
```

The script uses each character's `search` name (or `name`) and picks the result from the right series.
It marks any result whose series it couldn't confirm with `?`.

To use a different picture for a character, save it as `images/<id>.jpg` (or `.png` / `.webp`).
A local file always wins. Without any image, a generated placeholder portrait is shown.

## Adding characters

Add a line to `js/characters.js`:

```js
C("id", "Name", "Series", "Title shown in gold", [STR, SPD, DUR, IQ, BIQ, ABL, AURA], { search: "AniList name" }),
```

Then run `node tools/fetch-images.js` to get the image. To give a new series its own placeholder colors, add it to `SERIES_COLORS`.
