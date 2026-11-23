# Anime Draft

A browser draft game. Each turn you draw a random anime character and slot them into one of 8 categories: Strength, Speed, Durability, IQ, Battle IQ, Abilities, Bum and Aura. A bot opponent drafts alongside you. When all 16 picks are made, the higher total wins.

## Play

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

Controls: click a slot or press keys **1-8**. You get 15 seconds per pick. If time runs out, your character goes into a random open slot.

## Scoring

- Every character has a hidden 1-10 rating in each stat (`js/characters.js`).
- A slot scores the character's rating in that stat.
- **BUM** is reversed. It scores `11 - average rating`, so it is the slot for your weakest draw.

## Adding character images

The repo ships without official artwork. Characters show a generated placeholder portrait until you give them an image. To add one, either:

- drop a file into `images/` named after the character's `id`, e.g. `images/jiren.jpg` (`.jpg`, `.png` or `.webp`), or
- set the `image` field in `js/characters.js` to a URL.

Wide images (16:9 or so) look best, because they fill the background like the in-game splash.

## Adding characters

Add a line to `js/characters.js`:

```js
C("id", "Name", "Series", "Title shown in gold", [STR, SPD, DUR, IQ, BIQ, ABL, AURA]),
```

To give a new series its own placeholder colors, add it to `SERIES_COLORS`.
