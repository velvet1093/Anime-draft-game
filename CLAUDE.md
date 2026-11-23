# Anime Draft

Play the game: https://claude.ai/artifact/438QPKjzTf2TK6aHy89nTK

## Rules for working on this repo

- End every reply to the user with the direct link to the game:
  `Play: https://claude.ai/artifact/438QPKjzTf2TK6aHy89nTK`
- After changing the game, republish that same artifact so the link stays the same:
  1. `NODE_USE_ENV_PROXY=1 node tools/fetch-images.js --download` (only needed when images/ is empty or characters were added)
  2. `node tools/build-artifact.js` (writes dist/index.html + dist/images/)
  3. Publish `dist/index.html` with the Artifact tool, passing `url: https://claude.ai/artifact/438QPKjzTf2TK6aHy89nTK`
     (read it first from a new conversation) and every file in dist/images as `files` (`images/<name>` -> `dist/images/<name>`).
- Character images are never committed (the repo is public). The images/ and dist/ folders are git-ignored.
- Stats stay hidden from the player until the clash phase. Don't show ratings during the draft.
