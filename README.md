# Anime Draft

A browser draft game. Each turn you draw a random anime character and slot them into one of 8 categories: Strength, Speed, Durability, IQ, Battle IQ, Abilities, Bum and Aura. A bot opponent drafts alongside you. When all 16 picks are made, the cards **clash** one-on-one in each category (your Strength card against theirs, and so on). Whoever wins more clashes wins the match. If clashes are tied, total stat points decide it.

## Play

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Controls: click a slot or press keys **1-8**. You get 15 seconds per pick. If time runs out, your character goes into a random open slot.

## Effects

Every card plays an effect when it appears, and the winner's effect plays again after each clash.

- **Signature effects**: Madara's Sharingan, Itachi's Mangekyō, Gojo's Infinite Void, Sukuna's slashes, Saitama's One Punch, Ayanokoji's White Room, Mob's ???% meter, and about 40 more. They're listed in `SPECIAL` in `js/effects.js`.
- **General effects** for everyone else, based on their best stat (if it is 80+): IQ shows floating equations, Speed shows speed lines, Strength cracks the ground, Durability adds a hex shield, Battle IQ a targeting HUD, Abilities a magic circle, and Aura flames.
- **Certified bum**: characters averaging under 40 get rain and floating L's.

To preview one character's effect, open `index.html#fx=madara` (use any character id).

## Scoring

- Every character has a hidden 1-100 rating in each stat (`js/characters.js`).
  Specialists are lopsided on purpose: Ayanokoji has 97 IQ but single digits in Abilities.
- A slot scores the character's rating in that stat.
- **BUM** is reversed. It scores `100 - average rating`, so it is the slot for your weakest draw.

## Character images

Images come from AniList. `js/images.js` maps each character id to an AniList image URL, and the game
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
