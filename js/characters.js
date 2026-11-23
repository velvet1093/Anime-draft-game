// Character roster.
// stats: [STR, SPD, DUR, IQ, BIQ, ABL, AURA] rated 1-10.
// BUM is not a stat: a character placed in BUM scores 11 - (average of all stats),
// so it is the slot for your weakest draw.
//
// Images: put a file in /images named after the character id
// (e.g. images/jiren.jpg, .png or .webp) or set `image` to a URL.
// Without one, the game draws a placeholder portrait.

window.CATEGORIES = [
  { key: "str",  label: "STRENGTH",   short: "STR" },
  { key: "spd",  label: "SPEED",      short: "SPD" },
  { key: "dur",  label: "DURABILITY", short: "DUR" },
  { key: "iq",   label: "IQ",         short: "IQ"  },
  { key: "biq",  label: "BATTLE IQ",  short: "BIQ" },
  { key: "abl",  label: "ABILITIES",  short: "ABL" },
  { key: "bum",  label: "BUM",        short: "BUM" },
  { key: "aura", label: "AURA",       short: "AUR" },
];

window.SERIES_COLORS = {
  "Dragon Ball Super": ["#ff7a18", "#7a1d00"],
  "One Punch Man": ["#ffd23f", "#6b3b00"],
  "One Piece": ["#e63946", "#3d0a10"],
  "Naruto": ["#ff9f1c", "#5a2000"],
  "Jujutsu Kaisen": ["#5e60ce", "#140f3a"],
  "Bleach": ["#adb5bd", "#141414"],
  "My Hero Academia": ["#2ec4b6", "#06323a"],
  "Attack on Titan": ["#8d6e63", "#231610"],
  "Hunter x Hunter": ["#80ed99", "#0b3a1e"],
  "Demon Slayer": ["#ef476f", "#2a0414"],
  "Death Note": ["#b0b0b0", "#0a0a0a"],
  "Mob Psycho 100": ["#c77dff", "#240046"],
};

const C = (id, name, series, title, stats, image) => ({ id, name, series, title, stats, image });

window.CHARACTERS = [
  C("goku", "Goku", "Dragon Ball Super", "The Saiyan Raised on Earth", [10, 10, 9, 6, 9, 8, 10]),
  C("vegeta", "Vegeta", "Dragon Ball Super", "Prince of All Saiyans", [10, 9, 9, 7, 8, 8, 10]),
  C("jiren", "Jiren", "Dragon Ball Super", "The Pride of Universe 11", [10, 10, 10, 6, 9, 6, 9]),
  C("beerus", "Beerus", "Dragon Ball Super", "God of Destruction", [10, 10, 10, 7, 9, 9, 10]),
  C("frieza", "Frieza", "Dragon Ball Super", "Emperor of the Universe", [9, 9, 9, 8, 8, 7, 10]),
  C("gohan", "Gohan", "Dragon Ball Super", "The Hidden Potential", [9, 9, 8, 9, 7, 7, 8]),
  C("krillin", "Krillin", "Dragon Ball Super", "Strongest Human", [6, 6, 5, 6, 8, 5, 5]),
  C("yamcha", "Yamcha", "Dragon Ball Super", "The Desert Bandit", [5, 5, 4, 4, 5, 4, 3]),
  C("mrsatan", "Mr. Satan", "Dragon Ball Super", "World Martial Arts Champion", [3, 3, 4, 4, 4, 1, 6]),
  C("saitama", "Saitama", "One Punch Man", "Hero for Fun", [10, 10, 10, 4, 7, 3, 8]),
  C("garou", "Garou", "One Punch Man", "The Human Monster", [9, 9, 9, 6, 10, 7, 9]),
  C("tatsumaki", "Tatsumaki", "One Punch Man", "Tornado of Terror", [3, 8, 5, 7, 8, 10, 8]),
  C("luffy", "Luffy", "One Piece", "Captain of the Straw Hats", [9, 8, 9, 3, 9, 9, 10]),
  C("zoro", "Zoro", "One Piece", "The Pirate Hunter", [9, 8, 9, 3, 9, 6, 9]),
  C("shanks", "Shanks", "One Piece", "The Red-Haired Emperor", [9, 8, 8, 8, 10, 8, 10]),
  C("kaido", "Kaido", "One Piece", "Strongest Creature Alive", [10, 7, 10, 5, 8, 8, 9]),
  C("usopp", "Usopp", "One Piece", "King of Snipers", [3, 4, 5, 7, 6, 5, 5]),
  C("naruto", "Naruto", "Naruto", "The Seventh Hokage", [9, 9, 9, 6, 8, 9, 9]),
  C("sasuke", "Sasuke", "Naruto", "The Last Uchiha", [8, 9, 8, 8, 9, 9, 9]),
  C("madara", "Madara", "Naruto", "Ghost of the Uchiha", [9, 9, 9, 9, 10, 10, 10]),
  C("itachi", "Itachi", "Naruto", "The Shadow Who Protected the Leaf", [6, 8, 5, 10, 10, 9, 10]),
  C("kakashi", "Kakashi", "Naruto", "The Copy Ninja", [6, 8, 6, 9, 10, 8, 8]),
  C("rocklee", "Rock Lee", "Naruto", "Handsome Devil of the Leaf", [8, 9, 7, 4, 8, 3, 7]),
  C("sakura", "Sakura", "Naruto", "Medical Ninja", [7, 5, 6, 7, 6, 6, 4]),
  C("gojo", "Gojo Satoru", "Jujutsu Kaisen", "The Honored One", [8, 10, 8, 9, 9, 10, 10]),
  C("sukuna", "Sukuna", "Jujutsu Kaisen", "King of Curses", [9, 9, 9, 9, 10, 10, 10]),
  C("toji", "Toji", "Jujutsu Kaisen", "The Sorcerer Killer", [9, 10, 8, 7, 10, 3, 9]),
  C("yuji", "Yuji Itadori", "Jujutsu Kaisen", "Sukuna's Vessel", [9, 8, 8, 4, 8, 6, 7]),
  C("ichigo", "Ichigo", "Bleach", "Substitute Soul Reaper", [9, 9, 8, 4, 8, 8, 9]),
  C("aizen", "Aizen", "Bleach", "The Mastermind", [8, 9, 9, 10, 10, 10, 10]),
  C("yhwach", "Yhwach", "Bleach", "Father of the Quincy", [9, 9, 9, 9, 9, 10, 9]),
  C("allmight", "All Might", "My Hero Academia", "Symbol of Peace", [10, 9, 8, 6, 8, 5, 10]),
  C("deku", "Deku", "My Hero Academia", "Inheritor of One For All", [9, 9, 7, 8, 8, 8, 7]),
  C("bakugo", "Bakugo", "My Hero Academia", "Explosion Hero", [8, 9, 7, 8, 9, 8, 8]),
  C("allforone", "All For One", "My Hero Academia", "Symbol of Evil", [8, 7, 8, 10, 9, 10, 9]),
  C("mineta", "Mineta", "My Hero Academia", "Grape Juice", [2, 3, 3, 4, 3, 4, 1]),
  C("levi", "Levi", "Attack on Titan", "Humanity's Strongest Soldier", [7, 9, 6, 8, 10, 4, 10]),
  C("eren", "Eren", "Attack on Titan", "The Attack Titan", [8, 6, 9, 7, 7, 9, 8]),
  C("gon", "Gon", "Hunter x Hunter", "The Boy from Whale Island", [8, 8, 7, 4, 7, 7, 7]),
  C("killua", "Killua", "Hunter x Hunter", "Heir of the Zoldyck Family", [7, 10, 7, 8, 9, 8, 8]),
  C("meruem", "Meruem", "Hunter x Hunter", "King of the Chimera Ants", [10, 10, 9, 10, 10, 9, 10]),
  C("netero", "Netero", "Hunter x Hunter", "Chairman of the Hunter Association", [8, 10, 6, 9, 10, 8, 9]),
  C("tanjiro", "Tanjiro", "Demon Slayer", "The Kind Demon Slayer", [7, 8, 7, 6, 8, 7, 7]),
  C("muzan", "Muzan", "Demon Slayer", "Progenitor of Demons", [8, 9, 10, 8, 7, 9, 9]),
  C("yoriichi", "Yoriichi", "Demon Slayer", "The Strongest Swordsman", [9, 10, 8, 8, 10, 8, 10]),
  C("light", "Light Yagami", "Death Note", "Kira", [2, 3, 2, 10, 6, 8, 9]),
  C("l", "L", "Death Note", "The World's Greatest Detective", [2, 4, 2, 10, 7, 2, 8]),
  C("mob", "Mob", "Mob Psycho 100", "The Psychic Middle Schooler", [3, 6, 5, 5, 6, 10, 8]),
];
