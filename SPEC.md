# Proxy Table — project spec and handoff

Proxy Table is a browser tabletop for playtesting Magic: The Gathering decks with friends before buying cards. It is one HTML file: open it in Chrome, Edge or Firefox and share the same file with friends. **The group plays Commander with 4 players, sometimes 5**, and everything is built and tested for that.

**Status (18 Nov 2026): v30.** Current file: `proxy-table-v30.html` = v29 + `deck29.js` (the Edit & test page rebuilt as an animated Deck Workshop with a Higgsfield looping video header and Build / Deck / Test tabs). `PT_BUILD = 30`. **Everyone at the table must use v30.**

**Mass check of the 7,000 most-played Commander cards (2 Nov).** Claude pulled the top 7,000 cards by EDHREC rank from Scryfall in Georges's built-in browser and saved them to his Downloads folder as `top7000-cards.json.gz`. The file was copied into the tests as `test/all.json`, and `test/r13.js` checks all 7,000 in about 10 seconds. Of the top 7,000, these are now fully understood:

| Most-played cards | Before v10 | v10 | v11 | v12 | v13 | v14 | v15 | v16 | v17 |
|---|---|---|---|---|---|---|---|---|---|
| Top 100 | 75% | 97% | 97% | 98% | 100% | 100% | 100% | 100% | 100% |
| Top 300 | 70% | 93% | 94% | 97% | 100% | 100% | 100% | 100% | 100% |
| Top 1,000 | 63% | 86% | 88% | 91% | 96% | 98% | 99% | 100% | 100% |
| Top 2,000 | 56% | 78% | 84% | 87% | 91% | 95% | 98% | 100% | 100% |
| Top 4,000 | — | 69% | 76% | 79% | 89% | 94% | 97% | 100% | 100% |
| All 7,000 | 47% | 63% | 68% | 71% | 86% | 92% | 96% | 99% | 100% |

r13 count: 4,849 (v12) → 5,922 (v13) → 6,366 (v14) → 6,648 (v15) → 6,858 (v16) → **7,000 of 7,000 fully understood (v17)**. Cards that still ask the player for a number: 67 (v11) → 57 (v12) → **7 (v13–v17)**.

The remaining gaps are a long tail of about 3,200 different wordings, most used by a single card.

**How v11 was built:** Georges asked for helpers to speed things up. Two helper agents worked in parallel on ranks 1,000–2,199 (`engine19a.js`) and 2,200–3,599 (`engine19b.js`) while Claude did the remaining top-1,000 gaps (`engine19c.js`). Each file had to pass `test/regress.py`, which lists any card that was fully understood in v10 but isn't anymore; it must print 0. Claude then merged the three files and ran every test suite.

The project tool can't accept a file that size from Claude, so Georges uploads it himself. Everyone at the table must use the same version. **Georges's goal (1 Nov): be able to test out any deck. For now, cover the ~100 most-played Commander and ~100 most-played Duel Commander commanders.**

**Real card text (v9).** On 1 Nov, Claude used Georges's built-in browser to fetch the real Scryfall Oracle text for the 198-name top list. 197 were found; "Uharis, the Stormspinner" isn't on Scryfall. The texts are in `test/top.json`, and the tests run the checker on them. **Result: 188 of 197 are fully understood (v8: 60 of 196).**

**Honest limit:** the engine reads rules text with patterns. "Fully understood" means every line of the card maps to something the engine does. It does not prove every interaction is right. The deck checker (lobby → "Check rules text", Game ▾ → "Check my deck's rules text…", lobby → "Check the most-played commanders") lists what it can't do. In a game, those parts show a "Do this by hand" box.

---

## 1. What is built

**Lobby:**
- Formats: Commander (40), Duel Commander (20), 60-card (20).
- Moxfield link or pasted list; exact printings; commander detection and picker.
- Scryfall data and art; saved decks; art styles; deck price; resume after reload.
- Check rules text; Check the most-played commanders.

**Earlier rounds:**
- **Rounds 1–4:** turns, stack and priority, mana, counterspells, cross-player triggers, targeting, removal, anthems, gain control, loops, graveyard casting, delayed triggers, full combat for 4–5 players, planeswalkers, sagas, battles, doublers, proliferate, undo.
- **v4:** counterspells ask what to counter; priority box shows full text and target; ability words; ", then" chains; doubling power; manual P/T buttons; draw/gain/scry triggers; token copies; "Do this by hand" boxes.
- **v5:** strict rules (only cards move cards; a logged 2-minute "Fix something by hand"); draw limits, can't gain life, casting limits, can't search; next-spell discounts; "look at the top N, take some, rest where the card says"; sandboxed deck checker.
- **v6:** combat damage, block and blocked triggers; modes; Equipment and Auras; "doesn't untap"; play from exile; clones and copy-spell; automatic counting; divided damage; affinity, delve, convoke (generic mana only).
- **v7:** extra turns and skips; monarch; initiative and all four dungeons; emblems; adventures, split cards, modal double-faced cards; foretell; morph, megamorph, disguise, cloak; cascade; storm; "when you cast this spell"; Thoughtseize-style hand attacks; Fact or Fiction piles; Rest in Peace, Leyline of the Void and Kalitas replacements; Path to Exile searches; Grand Abolisher abilities; damage triggers; switch P/T; goad.
- **v8:** top-commander check; eminence and command-zone abilities; ninjutsu; "that many"; sacrifice, becomes-tapped and leaves-graveyard triggers; trigger doubling (Panharmonicon, Teysa, Isshin); player counters; discover; Jodah's exile-until; Muldrotha and other graveyard permissions; Chatterfang; counting anthems; Giada; extra land drops; blink; mass keyword grants; tap-N and sacrifice-X costs.

**v9 (1 Nov 2026): built from the real text of the top commanders**

*Names and wording*
- Current Oracle text uses short names ("Whenever Edgar attacks", "Korvold enters", "Kaalia attacks an opponent"). Legendary cards now match their first name and the part before the comma, "of" or "the". Non-legendary cards don't, so "Goblin Warchief" doesn't swallow the word "Goblin".
- Static text with quotes inside ("…have "{2}, {T}, Sacrifice this: You gain 3 life."") now reads correctly.

*New triggers*
- "Whenever you attack"; "the Ring tempts you"; "an opponent loses life (for the first time / during your turn)"; "you discard"; "you play a land or cast a spell"; "nonland cards are milled".
- "~ is dealt damage"; "an opponent searches their library"; "you roll a 4 or higher"; "you commit a crime"; "-1/-1 counters are put on a creature"; "becomes the target of a spell or ability an opponent controls".
- "Cards are put into exile during your turn"; "the final chapter of a Saga resolves"; "you waterbend, earthbend, firebend, or airbend"; "land cards are put into your graveyard from anywhere".
- "Your first spell during each opponent's turn"; "a spell while ~ is attacking"; "a spell that targets…"; "a spell with mana value N or greater"; "a spell with {X}"; "first / postcombat main phase"; "each player's end step".
- "This ability triggers only once each turn."
- Life gained and lost this turn are tracked per player and shared with the table (Y'shtola, Valgavoth, Kefka, Betor, Hope Estheim, Ragost).

*Mechanics*
- **"If this is the Nth time this ability has resolved this turn"** (Omnath, Ms. Bumbleflower, Sephiroth).
- **Reflexive triggers:** "When you do, …" happens only if you did (Caesar, Grist, Terra, Ratchet).
- **The Ring tempts you:** Ring-bearer choice, level emblems 1–4, tempt triggers (Sauron, Frodo).
- **Amass; explore; connive; blight; earthbend; airbend; waterbend costs; firebending; mobilize.**
- **Crew, station / Spacecraft, More Than Meets the Eye / convert, transform from abilities and triggers** (Kefka, Kuja, Brigid, Emet-Selch, Esper Terra).
- **Voting** (Tivit, incl. the extra vote); **rad counters** (mill at your main phase); **named counters** (chorus, intel, finality, charge); **moving counters** (Tidus).
- **Dice rolls** (Mr. House); **"choose an opponent at random"** (Vial Smasher); **odd or even** (Thanos).
- **Atraxa, Grand Unifier's** one card of each type; **Choco's** two-part dig; **Teferi's** "one in hand, the other on the bottom"; reveal-until for creatures, planeswalkers, Sagas and Shrines.
- Copies: 4/4 black Zombie copies (Scarab God, Hashaton); token copies that sacrifice unless you pay (Ashling, Satya with energy); Azula and Fin Fang Foom copy spells; Ulalek copies spells and abilities.

*Statics*
- Assign combat damage by toughness, and defenders can attack (Arcades, Felothar, Plagon).
- Lands enter untapped; Esika gives legendary creatures vigilance and mana; Food everywhere (Ygra, Ragost) plus Sam's Food discount.
- Look at and play from the top of the library (Glarb); K'rrik's 2 life for {B}; cascade from statics (The First Sliver, Zhulodok).
- Lier's flashback; Emet-Selch/Hades graveyard play and exile replacement; Green Goblin's graveyard discount and mayhem.
- Power-equals-count creatures (Namor, Lumra, Sisay, Krang, Kellan); Trance Kuja's double damage; Aang's WUBRG discount.
- Kratos's haste for all; Thrun's indestructible on your turn; Tom Bombadil's lore check; Ketramose's seven-in-exile.
- Dargo's sacrifice-for-discount; Cloud's and Isshin's extra triggers.

*Effects*
- Many one-off sentences from those cards: Kefka's card-type draw, Celes, Vohar, Lord Windgrace, Felothar's draw-and-discard, Kroxa's escape check, Gitrog's upkeep.
- Meren-style graveyard returns with limits; Betor; Light-Paws' Aura search; Cloud's attach; Ellivere's Role.
- Captain Howler's pump-and-draw; Ghyrson Starn's 2 extra damage; Wan Shi Tong's X and the "opponent searches" draw; Hidetsugu and Kairi; Thrasios; Tymna; Obeka's extra upkeeps; Acererak's dungeon check; Scarab God's return.

**Still by hand (9 of 197):**
- Maralen (casting from cards exiled from an opponent's library).
- Kotis (casting an opponent's exiled cards).
- The Necrobloom's dredge.
- Eriette's "can't attack you".
- Jace, Multiverse Architect's attack tax.
- Altaïr's memory counters.
- Aminatou's −6 and Tevesh Szat's −10 (control exchanges).
- Urza's meld.

**v10 (2 Nov 2026), rounds 10–18, built from the mass check:**
- **Votes:** each player votes on their own screen.
- **Opponent choices on their own screen:**
  - "Unless that player pays" (Rhystic Study, Mystic Remora, Esper Sentinel, Smothering Tithe).
  - "Its controller creates…" (Beast Within, Generous Gift, Pongify, Swan Song, An Offer You Can't Refuse).
- **Tutors and searches:** tutors that put a card on top (Vampiric, Mystical, Enlightened, Worldly); Land Tax and Knight of the White Orchid ("if an opponent controls more lands").
- **Devotion:** Gray Merchant, Nykthos; gods aren't creatures below their devotion.
- **Attacks and combat:**
  - Attack taxes (Propaganda, Ghostly Prison, Sphere-style) and Eriette.
  - Opponents' creatures entering tapped (Authority of the Consuls, Blind Obedience, Thalia).
  - Fog (combat damage prevented for everyone).
- **Untapping:** Seedborn Muse, Unwinding Clock, Drumbellower; Intruder Alarm.
- **Extra mana:** Wild Growth / Utopia Sprawl / Crypt Ghast / Mirari's Wake / Mana Flare; Urborg / Yavimaya / Dryad of the Ilysian Grove / Chromatic Lantern; Blood Moon; Cryptolith Rite; Goldspan's Treasures.
- **Keyword mechanics:** cumulative upkeep; hideaway; riot; Class levels (abilities unlock by level); man-lands ("becomes a 2/2 … until end of turn"); channel and other "Discard this card:" abilities from hand (with the legendary discount); gift, kicker and bargain checks.
- **Spells:** "Choose one. If you control a commander, choose both" (Jeska's / Akroma's Will); self-exiling spells; spells that shuffle into the library.
- **Counters:** any named counter (burden, age, charge, keyword counters, …).
- **Granted abilities:** quoted triggered abilities a card gives another ("gains 'When this dies, return it…'") now actually trigger.
- **Life and draw:** life lost this way; Windfall / Wheel of Fortune / Timetwister; Mana Drain's delayed mana; Arcane Denial's upkeep draws; Laboratory Maniac.
- **Reminders the table handles** (shown as "do by hand"): phasing, "until your next turn" effects, changing targets, control swaps, Spree costs.

**v11 (2 Nov 2026), rounds 19a–c:**
- **Modes:** Spree and Tiered, with the extra costs added when you cast; Confluences ("choose three, you may repeat"); the Seasons' {P} modes.
- **Rebound** for real (exiled, then cast free at your next upkeep); Monstrosity; Ascend and the city's blessing; Dark Depths / Marit Lage.
- **Things the engine now remembers:** what was sacrificed or discarded to cast a spell (Fling, "the sacrificed creature's power"); revolt (Fatal Push); creatures that died and tokens that entered this turn; last-known power and toughness of creatures that left the battlefield.
- **New triggers:** "becomes untapped", "plays a land", "put into a graveyard from anywhere, shuffle" (Kozilek, Ulamog), "+1/+1 counters are put on ~".
- **Lasting effects:** "until your next turn" keyword grants; Teferi, Time Raveler; Massacre Girl.
- **Mana:** Sliver, Ally and enchanted-land mana abilities; Manamorphose.
- **Statics:** Cursed Totem, Meekstone, Mox Diamond, Chrome Mox (imprint), Academy Manufactor, Roaming Throne, Underworld Breach (escape), Sylvan Library.
- **Opponents' creatures** can now really be put on the bottom of their owner's library (new `r19tuck` request).
- **About 300 one-line effects** across the list.


**v12 (2 Nov 2026, overnight): full automation wave, lobby fix, pages, final stax test**

*How it was built:* five helper agents worked in parallel, one domain each (`engine21a`–`21e`), while Claude did the lobby, the pages, the four test decks (`engine22`), auto-pay and the final test. Every file passed `regress.py` with 0 regressions.

- **Lobby bug fixed (same code → different tables).** Three real causes, all reproduced in `test/rlobby.js` (v11 fails 5 of 6, v12 passes 6 of 6):
  1. Codes typed on a phone didn't match: Arabic-Indic digits, en/em dashes, capitals and accents were stripped. Codes are now normalised (`Goblin–١٢٣٤` → `goblin-1234`).
  2. A player whose clock was more than 4 minutes off was ignored by everyone. Staleness is now judged by when we last heard from them.
  3. Joining a code while already seated at another table silently kept the old table. Now it moves you.
  - Also: every page load gets its own player id (duplicated tabs used to share one); leaving the page clears your board at once; the top bar shows "N/3 relays · N seated".
- **Separate pages.** The lobby is now five pages (My decks · Load a deck · Deck check · Play · How it works) and moves to the next page by itself after a deck loads. In a game, **Effects** in the top bar opens an "Effects in play" page listing every rule-changing permanent on the table, with the ones affecting you in gold.
- **Auto-pay ("tap my lands for me").** If your pool is short, the engine taps your own untapped mana sources to pay any cost: casting, abilities, Rhystic/Remora/Smothering Tithe "pay or…" prompts, attack taxes, echo/upkeep costs. Least flexible sources first; exact-fit for generic. Game ▾ → "Tap my lands to pay automatically" turns it off.
- **Counters (21a):** toxic/poisonous, infect, wither, Etali's poison (player only), all named counters visible to other players, counters remembered when a permanent leaves (Hangarback), proliferate with no dialog (picks the helpful choices), counter triggers and thresholds.
- **Upkeep and alternative costs (21b):** cumulative upkeep with any cost, echo, vanishing, fading, Stasis; delayed triggers; "until your next turn"; extra combats/turns. One-click hand options for cycling (all kinds), transmute, suspend, plot, dash, blitz, spectacle, surge, prowl, web-slinging, emerge, prototype, warp, bestow, overload, evoke; miracle offered on the first draw each turn; madness; kicker/multikicker/buyback/replicate; embalm, eternalize, encore, aftermath, fuse, improvise, manifest. Stax taxes apply to all of them.
- **Mana (21c):** mana audit of all 1,184 mana abilities in the 7,000: 1,169 now produce the right mana (was 985). Counted mana, chosen colours, "could produce", filter lands, Nyxbloom/Reflection/Caged Sun/Kinnan, restricted mana enforced, spirit guides.
- **Stax (21d):** every restriction in the Grand Arbiter list is enforced on the restricted player's own screen: cost taxes (both Thalias, Sphere, Thorn, Damping Sphere, Arachne, Dovin, Aura of Silence…), Rule of Law/Archon/Canonist, Grand Abolisher/Silence/Ranger-Captain, Drannith, Lavinia, Narset, Notion Thief, Aven Mindcensor, Opposition Agent, Pithing Needle/Revoker/Petrified Hamlet, Null Rod, Torpor Orb/Hushbringer/Karn/Elesh Norn, Strict Proctor, Kismet/Blind Obedience/Archon, Static/Winter Orb, Stasis, Back to Basics, Smokestack, Tangle Wire, Knowledge Pool, Moat, Containment Priest, Spelltithe Enforcer.
- **Other players' cards and the stack (21e):** casting a card another player owns (owner's client exiles it, it ends in the owner's graveyard, never duplicated): both Etalis, Ragavan, Gonti, Hostage Taker, Praetor's Grasp, Bribery, Kotis, Maralen, Mnemonic Betrayal and more; Dauthi Voidwalker; gain-control Auras; change-the-target (Bolt Bend, Deflecting Swat), Commandeer, Remand/Memory Lapse, Trickbind, Spellskite.
- **The four test decks (22):** look-at-top-X (Memory Deluge, Consult the Star Charts), put into library Nth from the top / bottom (Oust, Condemn, Teferi, Unexpectedly Absent, Terminus), Approach of the Second Sun (win on the second cast), Sunset Revelry, Fateful Absence, Necropotence (card comes back at end step), Necrodominance (hand size 5, exile instead of graveyard), Teferi's Protection, Mana Echoes, Demonic Consultation, Tainted Pact, Intuition and Gifts Ungiven (the opponent chooses on their screen), Council's Judgment (everyone votes on their screen), Charismatic Conqueror (opponent decides), Jace TMS, Triumph of Saint Katherine, Tataru Taru, Chrome Mox imprint as a trigger.
- **Moxfield "// COMMANDER" export** (no header before the main deck) now loads correctly; before, the whole list became the commander.

**Final test (rfinal.js): 4 players, bracket 4, real decks and Oracle text.** Georges: Grand Arbiter Augustin IV stax (100). Kim: Georges's Elminster list (99, his file is one short). Noor: Edgar Markov bracket 4 (100, Archidekt). Sam: Kraum + Tymna Blue Farm (100, Archidekt; really cEDH/bracket 5). **33/33 checks pass**, including: 20 stax pieces at once; Grand Abolisher; Georges's own Swords {2}{W} (Thalia, Sphere, Thorn, −1 Arbiter); Kim's Brainstorm {5}{U}; Static Orb; Lavinia; Rule of Law; Spelltithe on Kim's screen; Blind Obedience + Hushbringer + Archon; Propaganda + Ghostly Prison (refused with no mana, auto-paid with lands); Narset; Drannith; Aven Mindcensor; Rhystic + Remora prompts; Necropotence; Elminster's scry discount; Kraum; Edgar's eminence; Approach; no "do it by hand" notes. Deck rules check: Edgar 91/92, Blue Farm 81/93, Elminster 74/89, Grand Arbiter 58/81 lines fully understood by the dry-run checker (the stax statics are enforced but the dry-run checker only reads some of them).


**v13 (2 Nov 2026, afternoon): the 7,000-card tail + deck editor**

*Cards.* Six helpers each took a slice of the popularity list (`engine23f` ranks 0–2264, `g` 2265–3530, `h` 3531–4449, `i` 4450–5292, `j` 5293–6159, `k` 6160–6999). Gaps went from 2,151 cards to 1,078. Every file passed regress.py with 0 regressions, then the merged build was re-checked and the cross-file conflicts fixed (Nahiri's Lithoforming count, Smallpox, Siege modes, test assertions). Highlights:
- Opponent choices on their own screen for dozens more cards (Tempt with…, Braids, Torment of Hailfire, Liliana −9, Karn's piles, Killing Wave, Slaughter the Strong, Council-style votes, Prisoner's Dilemma).
- Playing the top card of your library is now possible (library menu → "Play/Cast the top card"; Bolas's Citadel pays life) — earlier cards like Future Sight and Courser of Kruphix were "understood" but had no way to do it.
- Auto-pay now counts extra-mana effects (Wild Growth, Caged Sun, Mana Reflection, Nyxbloom, Crypt Ghast); High Tide and Bubbling Muck for everyone.
- Conditions ("if you control your commander", metalcraft, descend, devotion, life lost this turn…), "for each opponent, up to one target", animation of lands and permanents, added types, keyword counters, d20 tables, Siege and "choose A or B" enchantments, phasing (Talon Gates, Slip Out the Back), damage prevention (Angel's Grace, Obscuring Haze), extort, bolster, incubate, paradigm.
- Bugs fixed in older code: "each opponent sacrifices a creature of their choice" never found a creature; "target creature an opponent controls" only offered players; Animate Dead didn't work; exiling a card from an opponent's graveyard gave it to you; Oblivion Ring never returned an opponent's permanent; extra request flags were silently dropped between players.
- **Still not automatic (1,078 cards), by family:** copy / "becomes a copy" effects (Thespian's Stage, Vesuva, Spark-style clones with exceptions), copying or exchanging spells and abilities on the stack (Isochron Scepter, Narset's Reversal), cost-rule statics (Omniscience, As Foretold, Morophon), "loses all abilities"/type changes (Imprisoned in the Moon, Dress Down), draw/token/damage replacements, granted quoted triggers, forced blocks, controlling another player's turn (Mindslaver), meld, secret simultaneous choices, and long-tail one-offs. Full per-card lists: `/tmp/F…Kgaps.txt` in the helpers' runs; regenerate with `OUTP=/tmp/X python3 test/gaps.py 0 7000`.

*Deck pages.*
- **Decks** page: saved decks and the load box together.
- **Edit & test** page: add any card by name (Scryfall autocomplete, quantity), + / − / ✕, ★ make commander, ↓ back to deck, click a name to read the card, Save keeps edits. Test: opening hand with London mulligans and draw-on, mana curve, colour pips vs land sources, a 4,000-hand simulation (2–4 lands in 7, 4 lands by turn 4), rules check, "goldfish it" (solo game). Test: `test/rdeck.js` (15/15).


**v14 (3 Nov 2026): the missing engine families**

Six helpers, one engine family each, each scanning all 7,000 cards (`engine24l`–`q`). 444 more cards fully understood, REGRESSIONS: 0. Merged-build conflicts fixed (animation vs layer pass; Double Major's nonlegendary token copy).
- **24l — copy effects (rule 707):** "enter as a copy, except…", "becomes a copy of", copies of copies, face-down copies, token copies; copy faces are published so opponents see the copy's real name/type/text. Spark Double, Clone, Phantasmal Image, Vesuva, Thespian's Stage, Mirage Mirror, Saw in Half, Mystic Reflection, Superior Spider-Man.
- **24m — the stack:** copy spells/abilities (Rings of Brighthearth, Bracers, Strionic Resonator, Twinning Staff, Chain Lightning), exchange/steal/redirect spells (Narset's Reversal, Perplexing Chimera, Invert Polarity, Delay, Possibility Storm), imprint-and-cast (Isochron Scepter, Mizzix's Mastery), Bonus Round, Tempt with Mayhem; stack targets are now chosen when the item is put on the stack (Mystic Snake); an "ability activated" event.
- **24n — costs and mana:** Omniscience, As Foretold, Dracogenesis, Rooftop Storm, Morophon, the Defilers, Heartstone and activation-cost changes, a general additional-cost parser (sacrifice/discard/life/exile…), convoke/improvise/emerge/replicate grants, spend-as-any-type, per-mana source tracking (Smaug, Inga and Esika, Treasure/color spent), unspent-mana rules, granted mana abilities.
- **24o — layers 4–7:** one pass for types, colors, abilities and base P/T on every board, published to all players: "loses all abilities" (Dress Down, Imprisoned in the Moon, Song of the Dryads), Oko's Elk, Sudden Spoiling; granted quoted triggered/activated abilities (Slivers, Backgrounds, "gains '…'"); skulk, landwalk, dethrone, melee, exalted, afflict, annihilator, myriad, bloodthirst enforced.
- **24p — replacements and combat:** damage redirection/prevention/doubling/"can't be prevented", excess damage, draw/death/token replacements, forced blocks and must-attack (wrapped at declare/confirm, the core const untouched), attack-alone/limits/taxes, extra beginning phases and upkeeps.
- **24q — events and rare mechanics:** new shared events (cast with zone, exiled, milled cards, attacked player, fights, damage dealt, abilities activated, targets, crewed, coin flips, life paid, mutate, exploit, day/night…); curses, mutate, meld, day/night, Demonstrate, undaunted, emblems for opponents, Final Fortune, planar die, Mindslaver/Emrakul (pragmatic: the controlled player's choices go to the controller's screen), opponent library reveals, piles, secret simultaneous choices.
- **Still open (634 cards):** starting-deck companions; trigger/mana doublers (Krang, Extraplanar Lens); attacker choosing blocks (Odric, Master Warcraft); "has all activated abilities of…" (Necrotic Ooze); players paying any amount in turn (Minds Aglow); Aboleth Spawn; a long tail of one-off wordings. List: `OUTP=/tmp/X python3 test/gaps.py 0 7000`.


**v15 (3 Nov 2026): last families + the tail**

Six helpers (`engine25r`–`w`): three engine families and three tail slices. 282 more cards fully understood, REGRESSIONS: 0. Every suite passes on the merged file.
- **25r — doublers and ability sharing:** Necrotic Ooze, Marvin, Drana and Linvala, Conspicuous Snoop, Experiment Kraj, Agatha's Soul Cauldron, Havengul Lich, Nicol Bolas Dragon-God; trigger doublers (Krang, Katara, Wulfgar, Felix, Wizard's Staff; "at the beginning of" triggers can now be doubled); Extraplanar Lens, Roxanne, Tyvar; Aether Refinery. Fixed Hellrider triggering 7× (static rules listed three times).
- **25s — cross-player protocols:** another player chooses blocks (Odric, Brutal Hordechief; Master Warcraft blocks; its attack half built but untested); join forces (Minds Aglow, Collective Voyage) with each player paying on their own screen in turn; Selvala's Stampede votes; delayed triggers bound to a creature/player (Hunter's Insight, Great Train Heist, Arcbond, Tamiyo); one player's end step (Tenuous Truce, Faramir); "for each player, choose…" (Tragic Arrogance, Winnowing); opponent-may chains. 3-player test (r2S).
- **25t — companions and deck rules:** Companion and Sideboard sections kept; companion revealed at start if its condition holds, {3} to hand once; deck-legality panel (size, singleton with "any number" exceptions, colour identity, partner/background/friends forever/Doctor pairs, companion conditions); sideboard = outside the game (wishes, learn, Karn); Gemstone Caverns; Chancellor-style opening-hand reveals. No banned list (no legality data).
- **25u/v/w — tail by rank:** stun counters; evolve; cleave; harmonize; endure; graveyard-cast permissions (Kagha, Danitha, Raul, Iroh); top-of-library casting for more cards (Sigarda, Thundermane, Fortune Teller's Talent); graveyard/suspend triggers; player hexproof published; Sigarda/Angel of Jubilation cross-player; can't-be-sacrificed; continuous goad; Platinum Emperion; Reflector Mage name ban; d20 multi-sentence rows checked; Kellan only on non-hand casts; airbend per the rules.
- **Merge fixes:** four canBlock wrappers returned `false` (= "can block") instead of a reason string, so Bedlam, "creatures can't block this turn", goaded-can't-block and two colour rules did nothing — fixed. engine25s's generic "until end of turn, whenever…" was swallowing Bonus Round and High Tide — both re-claimed. engine9 stats wrapper null guard.
- **Still open (352 cards):** the legend rule is not enforced (sacrifice the extra copy yourself); Rooms; soulbond, splice, exert, bargain, harness, Cases; casting others' cards in a few more forms (Gonti variants, Tinybones); sneak; time travel; "exiled with this card" tracking across players; a long tail of one-offs. List: `OUTP=/tmp/X python3 test/gaps.py 0 7000`.


**v16 (3 Nov 2026, evening): rules audit, last mechanics, the tail**

Seven helpers (`engine26a/b/c` tail by rank, `26x` state-based actions, `26y` mechanics, `26z` linked exile, `26s2` speed). 210 more cards fully understood, REGRESSIONS: 0, every suite passes on the merged file.
- **26x — state-based actions (CR 704) audit:** the legend rule is now enforced (owner chooses; others go to the graveyard, not sacrificed; copies compare by copy name; Mirror Gallery/Sakashima/Cadric/Hall of Echoes respected); simultaneous deaths with look-back triggers (Blood Artist sees creatures dying alongside it); SBAs repeat until stable before priority; drawing from an empty library loses (Lab Maniac still wins); "can't lose" really stops losing; illegal Auras/Equipment/Fortifications fall off; counter annihilation; Saga sacrifice; world rule; one Role per creature; tokens off the battlefield cease to exist; dungeon completion; face-down creatures now die to lethal damage like any other.
- **26s2 — speed / Start your engines!:** per-player speed (max 4, once per turn on your turn when an opponent loses life), shown to everyone; max-speed abilities locked below 4; the checker no longer passes max-speed lines it doesn't enforce (all 8 speed cards had been false passes).
- **26y — mechanics:** Rooms (doors, unlock, fully unlocked), Cases, Infinity Stones/harness, soulbond, exert, bargain, splice, sneak, time travel, cloak, Kozilek's manifest from hand; granted cascade/affinity/warp/prowl/miracle/encore/foretell/plot; "becomes tapped" triggers.
- **26z — linked exile (CR 607) across players:** Banishing Light family now really returns cards (it was broken for everyone); Ghost Vacuum, Nautiloid Ship, Gisa, Mechtitan Core, Angel of Serenity, Colfenor's Urn; playing other players' exiled cards (Gonti Night Minister, Tinybones, Gix, Nashi, Rev, Silent-Blade Oni, Valgavoth, Kefka, Elder Brain, Mari, Tasha); "spell you don't own" triggers fixed.
- **26a/b/c — tail:** Scroll Rack, Goblin Welder, Chainer, Plumb the Forbidden, Scheming Symmetry, Massacre Girl Known Killer, Fraying Sanity, Winter Moon, Ultima, Gauntlet of Power, The Aetherspark, Tishana's Tidebinder, New Blood, Reins of Power, Khârn, Oubliette, Sphinx's Tutelage, Portent, Deck of Many Things, Telepathy, Lantern of Insight, Willbreaker, Kira, Out of Time, Requiem Monolith, Radiant Lotus and more; short legend names (Ao, Uro, Oko) recognised.
- **Core fixes:** runEffects used to skip "~ gets +N/+N until end of turn" (≈9 cards were false passes); published exile now hides face-down cards ('facedown'); Dionus trigger typo; Out of Time phasing all creatures back in.
- **Still open (142 cards):** Brave the Sands (multi-block), Xantcha (opponents activating your permanent), Yedora (face-down land), Crypt Rats ({X} activations), Jeweled Amulet, Noble Heritage (protection from a player), Aminatou −6, Share the Spoils, Triple Triad, stickers, Planechase, and one-offs. List: `OUTP=/tmp/X python3 test/gaps.py 0 7000`.


**v17 (4–5 Nov 2026): the last 142 cards**

Six helpers (`engine27a/b/c` single-faced cards by rank, `27d/e` double-faced cards, `27f` transform/convert/prepared/day-night). All 142 fully understood, REGRESSIONS: 0. The session's server restarted mid-wave on 4 Nov; four helpers were resumed from their saved work on 5 Nov.
- **27a:** Brave the Sands (block extra attackers, defender splits damage), Duplicant, Xantcha (enters under an opponent; any player may activate), Yedora (face-down Forest), Jeweled Amulet, Noble Heritage (protection from a player, published), Illusionist's Gambit, Invoke Calamity, Dance with Calamity, Locke; **sunburst** and **dredge** implemented for every card (both had passed as bare keywords); level up (Joraga).
- **27b:** Aminatou −6 (permanents rotate to the next player on every client), Share the Spoils, Triple Triad, Balor (modes to different opponents), Kitesail Larcenist, Guff Rewrites History, Pendant of Prosperity, Breeches, Sokrates, Senu (new "unblocked" event); **fabricate**, **umbra armor** and **offering** implemented generally (they had passed without doing anything); a shared "player lost" flag (`b27lost`).
- **27c:** Crypt Rats (black-only X), Oft-Nabbed Goat (only opponents may activate), Gemcutter Buccaneer, Kíli (storied), Ramses, Hot Pursuit, Hellish Rebuke, Grothama, River Song's Diary, Psychic Paper, Xanathar; **saddle** and non-mana morph costs implemented.
- **27d:** back faces: Birgi (boast now really needs an attack, once a turn, twice with Birgi), Ral (his +1 discount had been always on), Tergrid, Rona, The Great Work, Agadeem's Awakening, Heliod, Wandering Archaic, Aclazotz, Vincent Valentine.
- **27e:** craft (Tithing Blade, The Enigma Jewel / Locus), Valki, The Rise of Sozin, The Legend of Yangchen, Welcome to . . ., Expansion, Secret Arcade, Grist, Marchesa, Cosima.
- **27f:** transform is now its own event (it used to fire "enters" triggers); "return it transformed" really returns the card (had been a false pass for the Ojers); exile-then-return as a new object (Sagas, praetors); **prepared** (CR 722) for real — the other prepare cards had been false passes; day/night shared by all players; spells cast last turn tracked; Zenos/Shinryu, Slicer, Starscream, Duskwatch Recruiter.
- **Core fix:** a permanent that is a copy "until end of turn" now reverts when it leaves the battlefield.
- **Known simplifications (the effects happen, the timing differs):** several multi-target cards (Balor, Guff, Larcenist, Agadeem's Awakening, Fire Lord Sozin) choose at resolution instead of on cast; saddle resolves immediately like crew; Share the Spoils' "when they do" is not a separate stack trigger; Locus of Enlightenment doesn't gain loyalty abilities.
- **Honest limit, unchanged:** "fully understood" means every line maps to something the engine does; it is a strong check, not proof that every interaction is right.


**v18 (5–6 Nov 2026): debugging — code audit + bot games**

Georges asked to switch from adding cards to bug fixing. Two new tools found the bugs, then three helpers fixed them. r13 stays 7,000/7,000, REGRESSIONS: 0.
- **Code audit (helper H, `AUDIT.md`):** parsed the whole build with acorn, mapped all 250 wrapped functions (doSentence has 88 layers), recorded which handler claims each of 11,040 effect sentences. Scripts in `/tmp/aud/`.
- **Bot games (helper G, `BUGS.md`, `test/fuzz.js`):** 4 clients, real and random 100-card decks, bots take random legal actions through the real UI and answer every prompt; after every action it checks crashes, card conservation across all clients, sane numbers, sync between clients, liveness and basic rules. First run: 63 games (2/4/5 players), 1,335 turns, 48,709 actions, 0 desyncs. `SEEDS=1-20 PLAYERS=4 node fuzz.js`, `python3 fuzzsum.py /tmp/fz -v`, `CASE=all node fuzzrep.js`.
- **Fixed from the audit (helper I, `fix18.js` + in place):** cross-player requests and events were capped at the last 30/40 per burst (Massacre Wurm left 10 alive) — now flushed before overflow; opponents' granted keywords were invisible (kwOf dropped pid: Akroma's Memorial flyers blockable); Languish/Golgari Charm killed nothing ("All" read as a creature type); r25DelayTry swallowed specific handlers (Vizkopa drained 0, Massacre Girl by hand); Wild Growth added mana from an already-tapped land; 80-char request field truncation (big sacrifice piles, graveyard shuffles); handWarn global swap; life-change clamp at 99; **private info encrypted** (ECDH P-256 + AES-GCM per player): Mindslaver hand, Xanathar top card, one-player questions — falls back to plain only for a player on an older file.
- **Fixed from the bot games (helper J, `fix18b.js`):** players who lose now leave the game in multiplayer (CR 800.4a: their cards leave, control returns, skipped in turns/priority/targets, can't be revived by life gain, "You lost — spectating" / "You won" banners; 2-player keeps the table for playtesting); a new token no longer makes its whole stack summoning sick; Deadly Dispute-style extra sacrifice of a noncreature crashed and skipped the cost (now paid, or the cast is undone); every Scryfall P/T form parsed (`*/1+*`, `7-*`, `*²`, ½, ∞) and CDAs computed (Barrowgoyf, Nighthawk Scavenger); number words up to ninety-nine plus hundreds/thousands (Mirrodin Besieged "fifteen").
- **Fixed (helper K, `fix18c.js` + in place):** keyword lines on instants/sorceries no longer leave "do by hand" notes, and the deck checker now dry-runs exactly what resolution runs; gift (incl. extra turn), cipher, casualty, escalate automated; X = 0 no longer re-asks; alternative costs with {X} ask for X; Three Tree City uses its chosen type; fallback tokens (Treasure, Food, Clue, Map, Blood, Gold, Powerstone, Junk, Role…) built correctly; Map explore; melee; Jace TMS +2 on an opponent (sealed top card); Karn −2 stray note; Flickerwisp return for opponents' permanents; Claim Jumper, Skittering Cicada, Level Up, Dovin −1, Noggle the Mind; "create 0 Treasure" made one.
- **Claude:** "Choose one or more" / "one or both" were read as "choose one" for every modal card (alternation order in engine6 MODE_RE); copies "until end of turn" revert when they leave.
- **Known, not fixed:** Vona's Hunger / Into the Flood Maw "instead" branches run slightly out of CR order; the gift recipient and escalate's tap cost are chosen at resolution; 6 cards still ask for a number.


**v19 (6 Nov 2026): table rules Georges asked for (`fix18d.js`)**
- **No face-down cards without a card that allows it.** "Turn face down / face up" and "Play face down" are hidden and refused under Strict rules; morph, disguise, manifest, cloak and foretell still work through their own buttons. "Fix something by hand" (2 minutes, logged) or Strict rules off still allows it.
- **Untapping by hand is only an undo of a mana tap whose mana is still unspent:** the mana leaves the pool with it, and the menu says so ("Untap — undo, takes back {W}"). A land whose mana was spent, a creature tapped by attacking (during or after combat), or anything tapped for another cost or effect can't be untapped by hand — only by the untap step or a card. Vigilance attackers never tap. Tapping by hand still works. "Untap one" on token stacks is refused the same way.
- **Tests:** new r18d 16/16. All 58 suites pass on the build (r2D, r2E, r2V failed only under four parallel streams and passed alone; r15's Etali step is the known flaky one). r13 7,000/7,000, REGRESSIONS: 0.


**v20 (6 Nov 2026, evening): taking opponents' cards + every older known gap**

Georges: "make sure you can take cards from your opponents when a card allows it" and "fix all the older things you said were not working". Four helpers; the list is `GAPS19.md`. r13 7,000/7,000, 0 cards ask for a number (was 6), REGRESSIONS: 0.
- **19a — taking opponents' cards (helper L):** ~164 cards scanned; 91 played in `r19a` (92 two-player + 7 three-player cases, both clients checked): 71/99 cases worked before, 99/99 after. "For as long as" steals (Sower, Silumgar, Mind Flayer, Rubinia, Olivia…) had no legal targets; Shackles/Old Man "remains tapped" + "you may choose not to untap"; pumps/haste/counters/types aimed at a stolen card are forwarded to the new controller; exchanges (Shifting Loyalties, Political Trickery, Spawnbroker, Puca's Mischief, Avarice Totem, Juxtapose, Cultural Exchange, Oko −5, two-opponent exchanges); exact ownership through loans of loans, graveyard/library steals and steal-backs; Auras/Equipment stay attached across control changes; X checks (Dominate, Blue Sun's Twilight, Thieving Skydiver kicker); Sliver Overlord/Hivelord name bug. Not played: Etali, Laughing Jasper Flint, Dack's emblem, Expropriate, Coveted Jewel, Assault Suit; overlapping control effects in timestamp order and stealing an attached Equipment are simplified.
- **19b — timing (helper M):** targets are chosen when a spell is cast or a trigger goes on the stack (visible to opponents before they respond) for Balor, Larcenist (ward paid then), Guff, Agadeem's Awakening, Phoenix III, Fire Lord Sozin, every "for each opponent, up to one target", and every other targeted trigger; gift recipient and escalate's tap at cast; "instead" branches picked before splitting (Into the Flood Maw); Share the Spoils' "when they do" on the stack; saddle on the stack; a failed cost leaves no cast triggers behind; Senu chooses its defender; Illusionist's Gambit restriction only in the extra combat; Sokrates in replacement order. Not done: total-mana-value targets (Ancient Brass Dragon, Rampaging Yao Guai), "each opponent's graveyard" targets, modal trigger modes.
- **19c — rules (helper N):** the Ring levels 1 and 3 enforced; convoke pays coloured mana; disguise/cloak ward {2}; earthbend returns the land; votes with any number of options; the last 6 number prompts compute (Urza's Saga Construct, Sunbird's Invocation, Glimpse the Impossible, Dihada, Hordewing Skaab, Knollspine Dragon — damage taken this turn now shared); Locus loyalty abilities; Yedora's land has no name; Satoru's second ninjutsu button; Rise of Sozin "up to four"; Marchesa; Hydroelectric Specimen uses real targets; card-name / creature-type pickers search all of Scryfall and all 324 types; Kefka counts types on each opponent's screen. Also: face-down and animated permanents are targetable and shared as creatures.
- **19d — other players' screens (helper O):** Kroxa, Acererak, Tasigur and "loses N unless they discard" decided on the opponent's screen; Dargo shows the cost per sacrifice; Jace, Multiverse Architect's attack tax; Altaïr's memory counters; Tevesh Szat −10; Master Warcraft tested; Aminatou exact owners; Mindslaver/Emrakul controller panel for the whole turn (not: activating the controlled player's non-mana abilities); Commander and Duel Commander banned lists in the deck check (reload old saved decks); a build-mismatch banner and no private data to older files; only the life buttons undo a 2-player loss.
- **Merge fixes:** fix19a's name-lookup wrapper slowed every unknown two-word name (made tests flaky) and its attach-follow delay kept Pacifism / Roles / Journey to Eternity on the battlefield after their creature died — both fixed; fix19c's Kefka discard trigger froze the stack waiting for a slow opponent — now finishes and tops up later. Tests updated for the new (correct) behaviour: r2C3 (saddle on the stack, life buttons), r2A3 (Gambit), r8 (Census count).


**v21 (7 Nov 2026): the problems left after v20 (`GAPS20.md`)**

Three helpers. r13 7,000/7,000, 0 number asks, REGRESSIONS: 0.
- **20a — choosing at the right time (helper P):** total-limited targets chosen at cast/trigger time and kept legal (Rampaging Yao Guai, Ancient Brass Dragon — its "when you do" is now a real second trigger after the d20 — Reunion of the House, Nethroi, Behold the Sinister Six!, Cloud's Blade Beam); "for each opponent, target card from that player's graveyard" chosen up front (Sepulchral / Diluvian Primordial, Tasha, Afterlife from the Loam); modal triggered abilities choose mode then targets as they go on the stack (CR 603.3c), "hasn't been chosen" and "at random" enforced. **Real bug found:** ~40 graveyard-targeting cards (Sun Titan, Life from the Loam, Reveillark, Macabre Waltz…) read their targets as battlefield permanents and did nothing in real games — the mass check never chooses targets, so it missed them; now fixed (34 swept in r20a). Goblin Welder and Junji's opponent-graveyard targets automated. Not done: end-step triggers with an "if" condition still choose targets at resolution (the condition can't be checked at trigger time for 39 of 42 cards).
- **20b — taking opponents' cards, the rest (helper Q):** both Etalis, Laughing Jasper Flint, Inevitable Betrayal, Oft-Nabbed Goat, Varchild already worked (now tested); fixed Dack Fayden's emblem (fired on every spell; now takes exactly the targeted permanents, and stack targets follow a permanent across control changes), Coveted Jewel (untapped the attacker instead of itself), Assault Suit (haste to a lent creature, "can't attack you" only protects the Suit's controller, can't be sacrificed), Expropriate money votes; control effects layered by timestamp (CR 613.7: a creature you stole and Reins of Power handed back returns to you at end of turn; Sower only ends when it leaves); Auras/Equipment you take while attached stay attached.
- **Claude:** X = 0 is a real value for "-X/-X" spells (Black Sun's Twilight left a by-hand note, found by the bot games).
- **20c — Mindslaver and test reliability (helper R):** the Mindslaver/Emrakul panel can activate the controlled player's non-mana abilities (tap, equip, crew, loyalty, graveyard, hand), done on the controlled client with its own resources, choices on the controller's screen. **Two real bugs:** "target tapped / untapped creature" never found a legal target (Royal Assassin), and loyalty −X asked for X twice. r15's Etali flake (since v12) was a test race — fixed, 5/5. r19a's late "timeouts" were the suite runner's 20-minute limit — the test is faster and the runner limit is now 40 minutes. Kefka's late-discard path tested. The bot checker knows "can't lose", phasing and the 2-player loss rule.


**v22 (8 Nov 2026): intervening-if triggers, bots, trainer**

- **fix21a — intervening "if" triggers (CR 603.4), helper S:** 293 triggers on 286 cards ("When/Whenever/At …, if <condition>, …"), ~200 distinct conditions, one evaluator (`s21Cond`, reusing `jCond` and the per-turn records). False when the event happens → no trigger, no prompt; true → targets/modes chosen as it goes on the stack; re-checked on resolution → does nothing (one log line) if false. Event facts (kicked, had counters…) are remembered. The deck checker reports any unknown condition. Fixed along the way: Alesha Who Laughs at Fate / Moseo graveyard targets, Zurzoth / Raphael / Gwaihir quoted "any target", Valakut counting the Mountain that entered, Scrapshooter's gift and Sowing Mycospawn's kicker, permanents with "counter target spell" abilities (Kozilek, Mystic Snake) unable to be cast with an empty stack. Merge fix: Animate Dead / Necromancy / Dance of the Dead had stopped returning the creature (the resolution override answered "true" for conditions jCond doesn't know) — fixed. Not done: Staff of Eden (no intervening if; target at resolution), Thieving Skydiver's kicker-X target filter, Earthbender Ascension's reflexive "if".
- **Bots, stage 1 (helper T):** each bot is a full separate player in a hidden iframe of the same file, joining like a person (only sees what its seat could see; runtime trap + code scan). Tables whose code starts with `local-` use an in-page relay, so solo games need no internet; normal tables mix humans and bots over MQTT (whoever adds a bot runs it). Lobby "Play against bots": 1v1 / 3 / 4 / 5 players, per bot name, level, deck (saved, random saved, copy of yours, random legal deck), speed (Normal 0.6–1.5 s / Fast / Instant); "Add a bot to this table…" in the Game menu. Bots answer every prompt (pay-or-not, votes, discards, sacrifices, legend rule, X, mulligans, blocks); anything unanswered after 12 s gets a safe answer; "do by hand" boxes are skipped and logged. Easy = loose legal play; Intermediate = curve, ramp, removal on the biggest threat, held instants, lethal checks, good blocks, threat target in pods. Card-roles module classifies every card with a strength score (EDHREC rank when available). Intermediate beat Easy 19–0–1 in 20 seeded 1v1 games. 3 bots ≈ 9% of one core, ~170 MB.
- **Bots, stage 2 (helper U), "beta":** Hard = full combat simulation (first/double strike, trample, deathtouch, lifelink, evasion, double blocks, pump risk), lethal and crack-back checks across the table, sequencing (cantrip before land only when it matters, creatures post-combat, fetch timing), holds counters and the right colours, instant-speed removal/tricks, value-based scry/modes/abilities. Very hard adds per-opponent threat scores, ~70 known combos and ~40 win-condition cards (counters combo pieces first), held removal, wipes when behind, no overextending. **Measured (seeded, seats swapped):** Hard vs Intermediate 50% (40 games); Very hard vs Hard 55% (40 games), 35% in a later 20-game run; Very hard won 5/12 4-player pods (42%). The 1v1 targets (65% / 60%) are not met — in mirror matches the play/draw and deck decide most games; a real edge likely needs Master's look-ahead. Both shown as "(beta)" in the lobby. `botAdvise(level, {point})` → {move, reason, detail}, ~15 ms, read-only. **Core freeze fixed:** other players only received the first 40 stack items, so with 40+ triggers nobody could see the top item to pass; now 400 (sanitizeEngine wrapper in botlevels2.js).
- **Built-in trainer (helper V):** watches only the local human's decisions (with what they could see), compares with Very hard's advice plus rules of thumb, and flags blunders / mistakes / inaccuracies / tips with a plain-English reason and the better line — missed land drops, unused or floating mana, mulligans, tapped-land sequencing, cantrip/land order, closing off colours for an instant, creatures before combat, tapping out instead of holding a counter, fetch timing, bad attacks, crack-back deaths, missed blocks/lethal, needless chumps, removal on the wrong target, ignoring a combo, feeding the leader, overextending, letting a wipe/combo resolve while holding a counter. Rules fire only when the engine can verify the better line; uncertain ones say "probably". Modes Off / Quiet / Live / Review; "Trainer · N%" in the top bar; tabs This game / Review / Coach. Coaching profile (last 60 games, localStorage): stage 1 basics → 2 sequencing → 3 decisions, top 3 weaknesses, focus for next game, progress last 5 vs previous 5, export/reset. ~0.5 ms per judged action. `trCoachRecord(game)` produces the privacy-safe decision record (`proxy-table/decisions@1`) the stage-3 Claude coach will consume.

**v31 (21 Nov 2026): the "still by hand" loops now run themselves**

- **Combat loops** (fix31a.js): attacks are remembered each turn. When an extra combat starts and the pattern repeats, or a known infinite-combat combo is out (Aggravated Assault + Sword of Feast and Famine, Combat Celebrant / Aurelia / Godo + Helm of the Host…), the table asks how many more combats, then declares the same attack each combat (plus new hasty creatures), repeats the main-phase steps (Aggravated Assault) and reuses your answers (exert). Opponents still block. Tested: Assault + Sword 9 combats, Celebrant + Helm 3 combats, both until Kim was dead.
- **Token piles:** a new token no longer joins a pile of tokens that already did something (exerted, attacking, pumped, counters) — Helm copies of Combat Celebrant used to inherit "already exerted".
- **Commander recast loops** (fix31b.js, Krenko + Skirk Prospector + Goblin Warchief/Chieftain): after the second cast from the command zone in a turn it asks how many rounds; each round taps the commander for tokens, sacrifices tokens for mana, sacrifices the commander to the command zone and recasts it, paying the growing tax. It checks first that the tokens can pay and keeps them if not.
- **Underworld Breach** (fix31c.js): repeats cast graveyard cards the way you cast them (escape), pick spare graveyard cards to exile (never the loop's pieces), and stop with the reason when there aren't enough; a round that does nothing stops the repeat.
- **Spells held on the stack** (Reiterate / Narset's Reversal on your own spell): after you copy your own spell, the original is held 12 s (each cast extends it; Next lets it resolve), the loop is spotted after two rounds, and repeats wait for the stack to come back to the held spell. Jeska's Will's "Add {R} for each card in target opponent's hand" now adds the mana (it added 0).
- **Kinnan, Bonder Prodigy:** the land side of a double-faced card (Bala Ged Sanctuary, Turntimber…) counted as a nonland permanent and got the extra mana. Checked: basic and nonbasic lands, City of Brass, Mana Confluence, Command Tower, Exotic Orchard, autopay — one mana each.
- **"Enters tapped unless you have two or more opponents"** (Bountiful Promenade cycle): entered tapped in every game; now untapped with two or more opponents.
- **Tests:** r31a (combat loops), r31b (Krenko), r31c (Breach), r31d (Reiterate), r31e (Kinnan, Promenade), all passing; regressions r2, r4, r9, r2E, r2F, r2H, r2C2, r26a, r28a, rdeck, combo groups thassa/mana/drain/recursion/ballista/zones/niv pass; askloop L12 fails on v30 too (not new). Online 40-turn bot pod with real cards: clean.

**v30.1 (20–21 Nov 2026): online, tested with real cards, Top commanders**

- **Hosted:** the game lives at https://georgesmarieyazigi-code.github.io/Proxy-table/ (repository `georgesmarieyazigi-code/proxy-table`: `main` holds src/, test/, tools/; `gh-pages` holds index.html and topdecks.json). Friends just open the link; fixes go live on reload.
- **Testing on GitHub:** `.github/workflows/playtest.yml` runs `ci.sh` on a GitHub machine with full internet (real Scryfall, card art, the Higgsfield video, the live site); logs and screenshots go to the `results` branch. `REAL=1` lets the tests reach Scryfall; `ONLINE=1` keeps the bot pod online so art loads.
- **Fixes found with real cards:** double-faced and split cards written "Front // Back" or "A/B" are looked up by their front face (Bloodline Keeper went missing from Edgar); granted-ability labels on lands are short ("taps for any colour") and no longer spill across the board; the deck page header falls back to the banner if the video can't load; no second commander picture on the deck page.
- **Caesar, Legion's Emperor:** the third choice ("deals damage equal to the number of creature tokens you control to target opponent") was left to do by hand; now automatic (fix30a.js, any "~ deals damage equal to the number of X you control to …").
- **★ Top commanders** (Decks page, topdecks.js): three tabs — cEDH top 8s and Duel Commander top 8s (MTGTop8, last 6 months, ranked by top-8 finishes, up to 3 recent decks each with place, player, event, players, date and a link) and Most played (EDHREC's top 100 of the year with the average deck). Search, art for every commander, "Load this deck" fills the deck box (Commander section + deck), switches to Duel Commander for duel decks, and names the deck after its source. Data: topdecks.json, built by tools/topdecks.mjs and refreshed every Monday by `.github/workflows/topdecks.yml`; every card name is checked against Scryfall (tools/checknames.mjs).
- **Tests:** r30c.js (Caesar, 6/6), rtop.js (picker, 12/12), test/livetop.js (live site + real Scryfall: decks from all three tabs load whole, 100 cards each).

**v30 (18 Nov 2026): the Deck Workshop (Edit & test page)**

- **Moving header:** an 8-second seamless looping video made with Higgsfield (Seedance 2.5, first and last frame = the same Higgsfield banner, so it loops without a jump): a candle-lit deckbuilder's desk with card stacks and glowing runes. Muted, no sound. Banner image as poster and fallback; with Animations off (Game menu) or no internet it shows the still banner or the plain look. Original artwork, no real cards or characters.
- **Over the header:** the commander's card (tilts with the mouse; partner commanders shown as two), deck name, format, price, an animated count ring (gold → green at exactly 100/60, red when over; pulses when the count changes), lands, average mana value, colours.
- **Three tabs** (remembered between visits):
  - **Build:** search all of Scryfall as you type (most-played first, up to 60 shown as card images that deal in). Type filters, "Only my colours" (commander colour identity, on by default), Commander-legal only in Commander formats. Tap **+** and the card flies into the deck count; cards already in the deck show "×N in deck". The old add-by-exact-name box and suggestions are kept.
  - **Deck:** a clear deck area: columns by type (Commander, Creatures, Instants, Sorceries, Artifacts, Enchantments, Lands …), each a fanned stack of real card images sorted by mana value. Hover a card to spread the stack and get − + ★ ✕ ⤢; a gold ×N badge for more than one copy; cards outside the commander's colours get a red outline; new cards glow; removed cards slide out. Cards / List view switch; Find in deck; the deck rules / companion / sideboard section underneath. ⤢ opens a large card view with its rules text and a "Rulings ✦" button into the Ask panel.
  - **Test:** mana curve bars grow in, colour pips vs sources, the 4,000-hand simulation, and opening hands dealt in one by one (mulligan, draw, goldfish).
- Everything the old editor did still works through the same actions; nothing new is stored except the tab / view choice (localStorage `pt.d29`).

**v29 (17 Nov 2026): new look, interactive table, Ask about your cards**

- **Artwork (made with Higgsfield, original designs):** a candle-lit tavern hero on the lobby, an emerald playmat with a faint gold circle under the battlefields, a green-and-gold Proxy Table card back (library and face-down cards), and a round-table emblem (logo and browser icon).
  - The art loads from Higgsfield's CDN. If it can't load (offline), the old look stays and nothing breaks. It isn't embedded in the file because the workspace couldn't download it.
- **Motion and pop-ups (`ui28.js`):**
  - **Cards:** they fly in when they enter your battlefield, hand, or an opponent's battlefield; cards in hand lift on hover; permanents glow.
  - **Life:** changes float up as green +N / red −N over the life total, which bumps; losing 5 or more flashes the screen edges red.
  - **Turn banner:** "Your turn" / "Kim's turn" sweeps across when the turn changes, and the active phase chip pops.
  - **Pop-ups:** dialogs pop in with a blurred backdrop, toasts slide up, the stack panel slides in, and new log lines flash.
  - **Loops:** the loop question gets a gold border and a spinning ∞.
  - **Combo ready:** a "Combo ready" card slides in at the bottom right.
  - **End of game:** a Victory overlay with confetti, or a Defeat overlay.
  - **Settings:** Game ▾ → Animations on/off is saved, and the system's reduced-motion setting is respected. Bots never animate.
- **Ask about your cards:** "Ask ✦" in the top bar, or the floating button in the lobby, opens a side panel.
  - **Name cards** ("How does Thassa's Oracle work with Demonic Consultation?", "Rulings for Sol Ring"): it finds the cards from your deck and the table (full name or the part before the comma), or any card by fuzzy name, and shows each card's image, Oracle text and official rulings from Scryfall. Rulings that match the question's words are highlighted and listed first.
  - **"Which of my cards …"** searches your deck by keyword or type: flying, haste, draw, ramp, removal, tutor, tokens, sacrifice, wipe, ETB, creature/instant/….
  - **Scryfall search syntax** (`o:flying t:creature`) runs on Scryfall and shows which matches are in your deck.
  - **Ask Claude too** sends the question with the cards' Oracle text and rulings to the Claude coach for an answer in plain words (needs the coach turned on with your key; ≤150 words).
  - **Honest limit:** Scryfall itself only gives official text and rulings; it doesn't answer free-form questions.

**v28 (17 Nov 2026): loops work**

**The table now recognises a loop as you start it and asks how many times:**
- **Trigger loops:** if every piece of a known infinite combo made only of triggered abilities is on your battlefield (Niv-Mizzet + Curiosity, Sanguine Bond + Exquisite Blood, Scurry Oak + Rosie Cotton…), its very first trigger asks "how many times?" ("until every opponent is dead" / a number / stop) before anything goes round.
- **Loops you do with actions:** if the pieces of a known infinite combo are out, the table asks after your first time round (Kinnan + Basalt: tap, untap → asked).
- **Unknown loops:** still spotted after two times round by hand, or after 10 chained triggers.
- **While the loop runs:** every question it asks again ("Curiosity: draw a card?", "Niv-Mizzet: choose target") gets your previous answer automatically, so nothing needs clicking.
- **Running out of library:** if the loop draws and your library runs out, it ends safely. Niv-Mizzet pings himself instead of an opponent, and a "may draw" is declined, so you never lose by drawing from an empty library. The question tells you how many cards your library has.

The 150 most-played infinite combos (2–3 cards, from the combo list) were each played in a real test game. The table had to ask "how many times", repeat it and land on the exact result. 98 combos have tests and all 98 work; combos that couldn't be tested are listed below.

- **Loop detection (`fix25a.js`):**
  - **Counters:** loops that grow counters (Scurry Oak, the Kilo proliferate combos, Carrion Feeder, Mikaeus lines) are spotted. Loops that use counters up (Walking Ballista pinging) are not.
  - **Same targets:** a sequence only counts as a loop when its answers (targets) match too, so "ping Ballista, ping Kim" isn't mistaken for "ping Kim" three times.
  - **Known combos:** a loop that gains nothing measurable but is a known combo (e.g. Gravecrawler + Phyrexian Altar alone) is still offered.
  - **Waiting for the last step:** right after tapping for mana the table waits 4 seconds before asking, so it doesn't interrupt you halfway through the second time round.
  - **Lining up the repeat:** if a loop was spotted one step early, the repeat starts at the step that matches where you are (`fix27z.js`).
- **Acting mid-stack:** loops that need you to act while something is still on the stack now repeat. Rings of Brighthearth + Basalt Monolith taps Basalt while its own untap is still waiting. The repeat remembers the stack depth and the number of resolutions at each step and holds the stack at that point.
- **Trigger loops:**
  - **Slow loops:** they're counted however long they take, as long as each trigger follows the last within 8 s; the question comes after 10 (it used to be 20 triggers in 30 s).
  - **Bursts:** a board wipe that triggers Blood Artist 25 times at once doesn't count as a loop.
  - **Held-back triggers:** a loop held back while the question was open is restarted with every one of its pending triggers.
  - **"Stop the loop here":** it no longer switches those cards off for the rest of the turn (fixed 10 s after the loop dies down; this bug existed before v26).
- **Trigger order (CR 603.3b):** when several of your triggers go on the stack together, the default order is token-makers first, then targeted ones. This makes Blowfly Infestation + Nest of Scarabs / Flourishing Defenses / Hapatra work.
- **Engine bugs found along the way (all existed before v26):**
  - **Face-down exile:** a card exiled face down (Necropotence, foretell) stayed face down in any zone it moved to. It could later be cast and enter the battlefield face down.
  - **Token piles:** a new token joined a pile that a spell or ability was targeting, so the effect hit the whole pile (Blowfly's counter killed two Insects).
  - **Storm cap:** storm and "spells cast this turn" stopped counting at 30.
- **Helpers' engine fixes:**
  - **Colour choice:** "any combination of colours" mana is now recorded correctly in a loop.
  - **Graveyard returns:** "{cost}: Return this from your graveyard" got a button (Reassembling Skeleton) and is repeated in loops.
  - **Big draws:** another player drawing more than 20 cards in one go (Peer into the Abyss).
  - **Target text:**
    - "target creature you control other than ~"
    - "two target artifacts, creatures, and/or lands"
  - **Free casts:** a free cast from the graveyard now offers alternative costs (Rooftop Storm).
  - **Food abilities:** Foods that get Devoted Druid's abilities now get its untap ability too.
  - **Buyback:**
    - cost reductions are applied after the buyback cost is added;
    - "Pay it" isn't greyed out by mistake;
    - a repeat answers the buyback question itself.
  - **Damage counts as draining:** "until every opponent is dead" is offered for Niv-Mizzet + Curiosity.
  - **Graveyard triggers:** "whenever a card is put into an opponent's graveyard" counts every card, not just lands.
  - **Planeswalkers:** their abilities are recorded and repeated (Teferi + Displacer Kitten).
  - **Auto-targeting:** "target player draws" spells no longer auto-target the opponent.
  - **Spell copies:**
    - copies count for magecraft and "cast or copy" triggers;
    - copies keep their target choice.
  - **Bruvac:** it doubles mills, including big ones.
  - **"Mills half their library":** done by the engine now, not left by hand.
  - **"Costs {N} less for each…":** worked out automatically (Blasphemous Act).
  - **Bolas's Citadel:** a repeat pays its life cost.
  - **Card types and historic:** "choose a card type" (Cloud Key) and historic cost reduction (Jhoira's Familiar) are handled.
  - **Return-to-hand costs:** "return a Forest you control" is paid automatically (Ashaya).
  - **Graveyard-only triggers:** a trigger that returns the card from the graveyard fires there (Forsaken Miner).
  - **Bowmasters:** its "whenever an opponent draws" half now triggers.
  - **Peregrin Took:** it adds its extra Food.
  - **Replay picks:** a repeat that has to sacrifice a token picks the same kind of token, not "the first card".
- **Still not looping by itself:**
  - **Combat loops:** Aggravated Assault, Combat Celebrant, Helm of the Host, Breath of Fury; attacks aren't recorded steps.
  - **Underworld Breach lines:** each round exiles different graveyard cards and storm grows.
  - **Commander tax:** Krenko lines cost more each time.
  - **Spells held on the stack:** Reiterate, Narset's Reversal.
  - **Pieces not named:** combos that need an unnamed third piece (Mikaeus + Viscera Seer, Broodmoth, Nim Deathmantle) work once you have one.
  - **Not infinite under the rules:** Springheart Nantuko's token copies the creature, not the land.
  - **Cards not in the test pool:** Kefka, Gorma, Automated Assembly Line weren't tested.

**v27 (13 Nov 2026): bug hunt**

Every bug below was reproduced on the v26 file first, then fixed; the repro tests are in `test/r26a.js` and `test/combos/askloop.js` (L7, L8).
- **False "This looks like a loop" questions (v26 regression).** In bot games the question popped up for things that aren't loops. Now a repeated sequence only counts as a loop if it gains something each time (mana, tokens, life, cards, drained or milled opponents) and doesn't use up life or tokens:
  - Necropotence activated three times (1 life each).
  - Three tokens sacrificed one by one to Viscera Seer.
  - A free ability used three times (Reconnaissance), a Food token, Mondrak's counter.
- **Combo memory didn't reset for a new game (v26 regression):** after Game ▾ → New game (or a new deck), "Combo ready" never fired again and the old deck's combo list was used.
- **Foray of Orcs** asked "how many? (damage)" and you could type the wrong number; it now deals the amassed Army's power (any "where X is the amassed Army's power").
- **Pack Leader's** attack trigger ("prevent all combat damage … to Dogs you control") was left to do by hand and the damage went through; it's now applied (combat damage only).
- **Token stacks:** taking one token out of a stack (to target or sacrifice it) gave an untapped token with no counters, even when every token in the stack was tapped or had counters. Example: attack with three Soldiers, pump one, and it untapped. It now keeps the stack's tapped state, counters and pumps.
- **Test harness only:** fuzz.js reported a split-off token as "entered this turn" (false alarm); the loop question's text is now recorded in bot-game logs.
- **Seen but not reproduced:** in 24 bot games two "This looks like a loop" questions came up whose cause couldn't be seen in the record; replaying those seeds didn't show them again. The next bot run records the steps, so they can be checked.

**v26 (13 Nov 2026): every loop asks "how many times?"**

- **Loops you do by hand are spotted (`fix25a.js`):** the table quietly keeps your last 40 actions (tapping for mana, activating, casting, and the answers you gave). When the same sequence happens twice in a row (three times for a single action), your board (non-token permanents, tapped state, counters) is back where it started, and it didn't cost you mana each time, it asks: "This looks like a loop — until every opponent is dead (N more times) / Repeat it — how many times? / It's not a loop". The repeat goes on the stack like "Repeat the loop", so opponents can respond. No more "Record a loop" first (it still works). Off for bots, during a repeat and while recording.
- **Loops nobody chooses (mandatory triggers):** after 20 triggers in a row (was 40) it asks "how many more times?": "Until every opponent is dead" (only offered when the loop is draining someone), "A number of times…", or "Stop the loop here". Every card in the loop gets that many more triggers, then it stops. Loops that drain nobody (Worldgorger Dragon) offer Stop first.
- **Combo memory (`combos25.js`, ~110 KB):** the 1,000 most-played Commander combos (cards, results, decks), from EDHREC's combo pages (13 Nov 2026). When every piece of one is in your hand / command zone / battlefield with at least one on the battlefield, the log says "Combo ready: … — do the loop once by hand and the table will ask how many times". Game ▾ → "Combos in my deck" lists the ones in your list. The loop question names the combo and what it does.
  - Data caveats: EDHREC only shows each colour's top 100. Five pages (Dimir, Selesnya, Golgari, Grixis, Jeskai) only gave percentages, so their deck counts are estimated (1% ≈ 31,000 decks, calibrated so Thassa's Oracle + Demonic Consultation lands at #2 as in EDHREC's own top-10); 235 of the 1,000 are estimates. Mono-blue came from an older EDHREC copy. Top 5: Hullbreaker Horror + Sol Ring, Thassa's Oracle + Demonic Consultation, Thassa's Oracle + Tainted Pact, Sanguine Bond + Exquisite Blood, Vito + Exquisite Blood. Raw data and scripts: `combodata/`.
- **Fixed on the way:** tapping a multi-ability mana source recorded the wrong ability, so some loops couldn't be repeated ("can't make mana"); a mana colour picked for "any colour" wasn't kept in a spotted loop.
- **Tests:** `test/combos/askloop.js` (group `askloop`): Kinnan + Basalt done twice → asked → ×7 exactly; Gravecrawler + Phyrexian Altar + Blood Artist twice → "until every opponent is dead" → Kim loses; Sanguine Bond + Exquisite Blood at 40 life → asked → runs to the end; "a number of times" → stops with Kim alive; combo memory; Hullbreaker Horror + Sol Ring + Ornithopter twice → ×6 → exactly +6 {C}.

**v25 (10 Nov 2026): infinite combos**

- **Combo suite (`test/rcombo.js`, groups in `test/combos/`):** 33 lines played through the real engine in a two-player game — each loop done once, recorded, then run with Repeat ×N, checking the exact gain per loop and the end result.
  - Thassa's Oracle / draw-out: Oracle + Demonic Consultation, + Tainted Pact, devotion ≥ library, Laboratory Maniac, Jace, Wielder of Mysteries, Ad Nauseam → Oracle, Hermit Druid → Oracle, Underworld Breach + Brain Freeze on yourself → Oracle.
  - Infinite mana: Kinnan + Basalt Monolith, Grim / Basalt Monolith + Power Artifact, Devoted Druid + Vizier of Remedies, Bloom Tender + Freed from the Real / Pemmin's Aura, Isochron Scepter + Dramatic Reversal + rocks.
  - Edgar drains: Sanguine Bond + Exquisite Blood, Vito + Exquisite Blood, Vito + Bloodthirsty Conqueror, Conqueror + Sanguine Bond — each runs by itself until the opponent is dead, then stops.
  - Graveyard recursion: Gravecrawler + Phyrexian Altar + Blood Artist, Mikaeus + Triskelion, Mikaeus + Murderous Redcap + Viscera Seer, Kitchen Finks + Melira + Viscera Seer, Reveillark + Karmic Guide + Viscera Seer, Animate Dead + Worldgorger Dragon.
  - Walking Ballista and classics: Heliod + Ballista, Kinnan + Basalt into a huge Ballista, Kiki-Jiki + Zealous Conscripts, Splinter Twin + Pestermite, Dualcaster Mage + Twinflame, Food Chain + Eternal Scourge.
- **Bugs found and fixed:**
  - Thassa's Oracle never won: the "look at the top X" part swallowed the win sentence. Fixed for devotion ≥ library and an empty library.
  - "You win the game" only wrote a line in the log; now every opponent loses (Oracle, Lab Maniac, Jace, and any other win).
  - Drain loops never stopped in a two-player game after the opponent lost (Kim went to −189). Once every opponent has lost the game is over: no new triggers, leftovers removed.
  - Power Artifact (and any "enchanted artifact's abilities cost {N} less") did nothing; Vizier of Remedies and Melira didn't stop −1/−1 counters (Devoted Druid died; Kitchen Finks stopped persisting).
  - Escaped instants and sorceries were exiled; they go back to the graveyard (the Underworld Breach loop).
  - "Target player mills" picked the opponent without asking, so you couldn't mill yourself (Brain Freeze); mill now always asks.
  - Demonic Consultation could only name cards you own; it now also offers "a card that isn't in my library".
  - Zealous Conscripts (and any threaten) on your own permanent didn't untap it or give haste (Kiki-Jiki loop).
  - Strive's cost line was read as a target, so Twinflame made no tokens; spell copies lost their targets when not given new ones (Dualcaster).
  - Loops recorded with an ability whose list object changed couldn't be repeated (Devoted Druid).
  - A loop no choice can stop (Worldgorger Dragon + Animate Dead) froze the table; after 40 triggers in a row from the same card the table asks "Stop the loop here / Keep going".

**v24 (10 Nov 2026): 500 bot games**

- **The run:** 500 games played by bots doing random legal plays on every seat, with rules, sync and card-conservation checks running the whole time: 250 four-player, 150 two-player, 100 three-player; 506 different decks (Georges's 4 real lists + 502 random Commander decks from the 7,000 cards); 10,268 turns, ~23 hours of play. Each problem found was fixed, tested and swapped into the running file.
- **Result:** 0 engine errors. 1 out-of-sync report (a library count caught mid-update; the checker now waits for a stuck value). 2 stalls: one was the test bot not knowing how to drive a Mindslavered turn (the real bots do; the test bot now does too); one happened mid Vito + Bloodthirsty Conqueror loop in a 3-player game under heavy load and could not be reproduced — the loop runs to the end when played alone (`test/vito23.js`). 1 rules report left unexplained (a land creature attacking the turn it entered, seen once).
- **Cards fixed (`fix23b.js`, all with tests in `test/r23b.js`, 29 checks):** The Aetherspark −10 (any "add N mana of one color"); Mad Wizard's Lair; Cruelclaw's Heist with no nonland card; Tangled Colony (damage dealt to it); Burakos (party size); Notorious Throng (damage dealt to opponents this turn); Sylvan Offering (X for the opponent's tokens); Hydra Broodmaster and other "X" from the event; Gadwick-style ETB X from the cast; Fire Covenant / Bronzebeak Foragers X = 0; Kefnet's Monument and Wall of Frost (opponent's creature doesn't untap); Tail Swipe; Suspended Sentence with no target; Loyal Inventor with the search declined; Lonis X = 0; Shadow, Mysterious Assassin; Minsc & Boo −2; Peerless Recycling (two targets); The Mycotyrant (P/T and end-step X); Mirrorworks; Crumb and Get It; Throne of the Dead Three and "until your next turn" keywords; Court of Ire and Grow from the Ashes (any "If …, instead …" and "it deals N damage instead"); Alesha; Oubliette; Mirri's Guile; Rock; Mutable Explorer (a token named after a real card is a copy of it — Mutavault is a land); Aven Interrupter; Rikku; Psychic Paper (the renamed creature gets its name back when it leaves); Lathiel; Communal Brewing; Dragonhawk; Akroma, Vision of Ixidor; Chandra, Flameshaper +2; Nylea, Keen-Eyed; Citadel of Pain.
- **Choices still asked (correct):** choosing X when casting, paying X life/energy/permanents as a cost, dividing damage among targets.

**v23 (9 Nov 2026): Master bot, Claude coach, bot-game fixes**

- **Master bot (helper W, `master.js`), "beta":** plays like Very hard, but at the decisions that matter (casting order, removal targets, attacks, blocks, counter responses) it tries each candidate move in a small model of the game, plays it out 2–3 turns ahead many times against sampled opponent hands (built only from what its seat can see), and keeps Very hard's move unless another is clearly better. 1.5 s per decision (cap 4 s) in small slices, so 3 Master bots use ~2% of one core. Also fixed for all bots: they no longer lose to their own Demonic Consultation; they attack planeswalkers and count their own attack triggers. **Measured:** Master vs Very hard 1v1 won 17 of the 30 games that had a winner (57%; 10 of 40 had none; target 60%); 3 of 16 four-player pods (19%; target 35%). Seat and deck decide most mirror games, so small skill gaps need hundreds of games over many decks to measure.
- **Claude coach (helper X, `coach.js`), optional:** Trainer → "Claude coach" tab. Uses Georges's own Anthropic API key, typed only into that tab: kept in this browser's localStorage, never in the game state, published data, logs, exports or the file, and sent only to api.anthropic.com. Sends the trainer's privacy-safe decision record (only what you could see; opponents anonymised, hand sizes only). Per-turn notes (at most one request per turn), a post-game review that builds on the coaching profile, and an "Ask the coach" box; monthly budget cap and cost meter. Default model Claude Haiku 5.5 (about half a US cent per 12-turn game); Sonnet 5.5 / Opus 5.5 selectable. Any failure (no key, offline, rate limit, budget) leaves the built-in trainer as it was. Tests use a mocked API only.
- **fix22a (helper Y):** the three cards from the v22 bot games — Treebeard, Gracious Host (the life-gain event now carries the amount, which also fixes Sanguine Bond / Vito-style "that much" abilities), Biosynthic Burst ("Untap it" after a targeted effect), Varragoth (an opponent searches on their own screen) — plus 32 more found once the deck checker started running every effect the way play does (real trigger fields, a source on the battlefield, one legal target, an opponent's where allowed).
- **fix23a + engine fixes (found by 4-player bot pods, Claude):**
  - "Whenever ~ deals (combat) damage …" triggered on **any** creature's damage: 30 Thopters connecting gave 30 Hoard Hauler triggers. Self-only damage triggers now check the source.
  - Board updates were debounced and every change restarted the timer, so a player changing state non-stop (a long trigger chain) never sent an update and the table waited forever. Updates now go out at least every 400 ms.
  - Token lookups that miss Scryfall weren't cached, so every token took ~100 ms; now ~2.5 ms.
  - A board update that fails to read is recorded (`NET.sanBad`) instead of vanishing.

**Multiplayer:** MQTT over three public relays, retained per-player state, heartbeat 20 s, silent 45 s = passed; old-file players flagged. Tested with 2, 3 and 5 players.

---

## 2. Code organisation

**Build:** a single file built from `head.html`, `main.js`, `engine.js`, `engine2.js`, `combat.js`, `engine4.js` … `engine18.js` (v10), `engine19a–c.js` (v11), `engine20.js`, `engine21a–e.js`, `engine22.js`, `autopay.js` (v12), `engine23f–k.js`, `deckedit.js` (v13), `engine24l–q.js` (v14), `engine25r–w.js` (v15), `engine26a/b/c/y/z/s2/x.js` (v16), `engine27a–f.js` (v17), `fix18.js`, `fix18b.js`, `fix18c.js` (v18), `fix18d.js` (v19), `fix19a.js`, `fix19b.js`, `fix19c.js`, `fix19d.js` (v20), `fix20a.js`, `fix20b.js`, `fix20c.js` (v21), `fix21a.js`, `bots.js`, `cardroles.js`, `botlevels.js`, `botlevels2.js`, `trainer.js` (v22), **`fix22a.js`, `fix23a.js` (before bots.js), `master.js`, `coach.js`** (v23), before deckedit, `pages.js`, `init.js`. `PT_BUILD = 23` in main.js is published so other players see version mismatches. Extra files can be added for a dev build with `EXTRA=a.js,b.js`.

**Effects pipeline:** `runEffects` (Nth-resolution counter → reflexive "When you do" split → `modalText`) → `doSentence` (→ `doRound18Pre` … `doRound10Pre` (v10) → **`doRound9Pre`** → `doRound8Pre` → `doRound7Pre` → `doRound6Pre` → `doRound5Text` → `doTargeted` / `doCombatText` → `handWarn`). Later rounds wrap earlier functions rather than editing them.

**v9 also wraps:**
- `tname`, `classifyTrig`, `subjMatch`, `subjOf`, `pushTrigger`, `handleEvent`
- `mill`, `moveCard`, `playLand`, `modCounters`, `searchLibrary`, `damageCard`, `chooseTargets`, `sagaDone`
- `stats`, `kwOf`, `hasHaste`, `canAttack`, `canBlock`
- `abilityList`, `abilityReady`, `activateAbility`, `manaAbs`, `descOk`
- `costMods`, `spellCost`, `beginCast`, `castTriggers`, `resolveTop`, `fireSteps`, `gyOptions`, `payPlan`
- `commit` (life tracking), `enginePublic`, `sanitizeEngine`, `livePTFor`
- `staticRulesOf` / `staticKnown` (quote-aware sentences, cached), `staticRules` (memoised until something enters, leaves or flips)

`isCreatureCard` and `typeOf` are now `let`, so animated permanents count as creatures (`c.anim`: crew, station, earthbend; Bello's 4/4s).

**State and events:**
- **Events:** `EV_TYPES` is the list of event types allowed between players. New: loselife, discard, mill, search, tempt, roll, crime, ctrm, tgt, exiled, sagaend, bend, land, togy, dealt, explore.
- **Public state:** `lt` (life gained and lost this turn), `ring`.
- **State:** `S.ring`, `S.resN` (resolution counts), `S.lt`, `S.bend`, `S.xland`, `S.sacT`, `S.gyOk`, `S.dgList`, `S.noBlock`, `S.xUp`. Cards: `c.nc` (named counters), `c.anim`, `c.ring`, `c.xv` / `c.spent` (X and mana paid), `c.zb` (Zombie copy), `c.disc` (discarded this turn), `c.howl`, `c.tdt`.
- **Delayed items:** `dop` = payOrSac, sac, retHand.

**Testing (v30):** `test/rdeck.js` updated for the tabs and extended, 18/18 (header and tabs, deck area as card images, Build search and add, list view, + / − / ✕ / ★ / ↓, save, hands, mulligan, draw, simulation); adding from the Build search results checked separately (count 100 → 101). r2T, rlobby, rdecks, r28a, r26a, r2–r7, r2A, r2B, r2C2, r2S, rfinal, rbots, rtrainer, rcoach pass; failures seen only with three test lanes at once (r2, r2B, r26a, rtrainer's timing check) all passed when rerun alone.

**Testing (v29):** new `test/r28a.js` 18/18 (Ask panel with mocked Scryfall: two named cards with highlighted rulings, deck search, Claude button greyed out without a key; floating life numbers, combo pop-up, card fly-in, turn banner, animations toggle, Victory overlay, lobby Ask button). All 75 suites on the final code: failures seen only under two-lane load (r19a, r2A2, r2E, r2T, r9) all passed when rerun alone. r19d's Acererak step also fails on v27 and v28, so it was already there before this change. Bots and trainer pass.

**Testing (v28):** rcombo over every group (basics, mana, drain, recursion, Ballista, askloop L1–L12, zones, Niv-Mizzet library, top_a/b/c: 98 combos), all passing on the final code (two environment restarts meant the tail was rerun on its own). r13: all 7,000 understood, 0 regressions. Suites rerun alone where they failed under load: all pass. rbots 97/97, r23b 29/29. Bot games (fuzz.js seeds 649–677): 0 errors, 0 desyncs, 0 stuck; one false loop question (three copies of the same spell) found and fixed.

**Testing (v27):** all 75 suites on the final code. Failures seen only under two-lane load passed when rerun alone: r2F, r2Q, r9, r2C2 (it caught a wrong change of mine to Blitzball Stadium, which already worked; removed), rbots. rcombo 192/192 (askloop L1–L8). r13: all 7,000 understood, 0 regressions. 48 bot games (fuzz.js seeds 601–648, 2–5 players): 0 engine errors, 0 desyncs, 0 stuck games.

**Testing (v26):** rcombo over 39 lines (`CGROUPS=thassa,mana,drain,recursion,ballista,askloop`): 177/177 in the full run, plus the Hullbreaker line 7/7 run on its own after a test-helper fix. r13: all 7,000 understood, 0 regressions. r23b 29/29, r22a 83/83, r21a 300/300, r18a 38/38, r20a 58/58, r19a 403/403, r19b 70/70, r19c 53/53, rbots3 187/187, rtrainer 91/91, rcoach 82/82 (mocked API only), r2 24/24, r10 21/21. rbots 97/97 (one "bot took part" check failed once under load, then passed alone).

**Testing (v25):** rcombo 159/159 checks over 33 combo lines on the final v25 file. All 75 suites ran; every failure under three-way load passed alone (r10, r2, r2E, r2K, r2J, r2T). r21a and r18a needed one test change: a player at 0 life or a win now really ends the game, so the tests bring both players back between steps (r21a 300/300, r18a 38/38). Ramses and Shinryu ("when that player loses the game, you win") still fire after the loss (r2C3 85/85, r2F3 65/65). rbots 97/97, rbots3 187/187, rtrainer 91/91, rcoach 82/82; rbots2 fails only its strength checks. r13: all 7,000 understood, 0 regressions, 0 number questions. Run the combo suite with `PTFILE=… PTPORT=… node rcombo.js` (`CGROUPS=thassa,mana,drain,recursion,ballista`, `ONLY=T1,M4`).

**Testing (v24):** all 74 suites on the final v24 file. Everything that failed while three ran at once passed alone (r2A2, r2E, r2W, r2F3, r2K, r6, r2V); r19c's N8 check depends on whether a Forest is still in the library and passes on reruns. rbots2 fails only its strength checks; 5 more four-player bot pods on v24 ran with no stall. rbots3 187/187, rtrainer 91/91, rcoach 82/82, rfinal 33/33, r23b 29/29. r13: all 7,000 understood, 0 regressions, 0 number questions. Bot-game summary: `python3 /tmp/f500/sum2.py` over `/tmp/f500/p*/g*.json`.

**Testing (v23):** 73 suites on the final v23 file in three parallel streams; everything that failed under load (r2E3, r9, r2K) passed alone, as did r18c, r2E, r2C, r2A2, r2V, r2T, r2W, r2F3, rcoach and r19d from an earlier run. rbots2 fails only its three strength checks (Hard vs Intermediate 8/20, Very hard vs Hard 8/20, Very hard 3/12 pods) — **12 four-player pods with no stall** (the earlier v23 candidate stalled in 3 of 4 Raphael pods: the damage-trigger and update-starvation bugs above). rbots3 187/187, rfinal 33/33, rcoach 82/82 (mocked API only). r13: all 7,000 understood, 0 regressions, 0 number questions. **Bot games on v23: 24 games (12 four-player, 12 two-player), 493 turns — 0 errors, 0 desyncs, 0 stuck, 0 rule problems.** To fix next, from those games: "do by hand" notes for Cruelclaw's Heist (cast from exile with any mana), Dungeon of the Mad Mage's Mad Wizard's Lair, The Aetherspark's "add ten mana"; Tangled Colony and Burakos asked for a number the engine could count. Debug tools: `test/hh23.js` (Hoard Hauler repro), the stall dump in rbots2 now shows passes, published states and stacks per player. Regress baseline `/tmp/base_per.json` = v23 (7,000).

**Testing (v22):** 70 suites on the merged v22 file; all pass when run alone except rbots2's two 1v1 strength checks (Hard vs Intermediate 9/20, Very hard vs Hard 7/20 in this run — hence "beta"). r10, r8, r2K failed once under four parallel streams and passed alone. New: r21a (299/300; the one failure fixed in the test), rbots 97/97, rbots2 161/164 (2 strength + 1 harness timeout), rtrainer 91/91. Test fixes: r2E picks a creature Hostage Taker can legally take (pro-black / ward / clone picks made it random). **Bot games on v22: 24 games (12 four-player, 12 two-player), 492 turns — 0 errors, 0 desyncs, 0 stuck, 0 rule or card-conservation problems.** Three "do by hand" notes to fix next: Treebeard, Gracious Host (target Halfling or Treefolk), Biosynthic Burst ("Untap it"), Varragoth ("target player searches … puts it on top" for an opponent). Regress baseline `/tmp/base_per.json` = v22 (7,000).

**Testing (v21):** 66 suites on the merged v21 file; all pass when run alone (r2A3, r2U, r9 had one failure each under four parallel streams and passed alone). r15's Etali step now passes (fixed test race). New: r20a 58 (92 with `SWEEP=1`), r20b 19 cases / 89 checks, r20c 40, r20t 3. **Bot games on v21: 30 games (12 four-player, 12 two-player, 6 five-player), 575 turns — 0 errors, 0 desyncs, 0 stuck, 0 card-conservation problems.** Two reports: Black Sun's Twilight with X = 0 left a "do by hand" note (engine8 skipped X = 0 — fixed, tested in r20t); an Arboreal Grazer land counted as a second land play (fuzz.js now counts only real land plays). Suite runner timeout raised to 40 minutes. Regress baseline `/tmp/base_per.json` = v21 (7,000).

**Testing (v20):** 62 suites on the merged v20 file; all pass alone except r15's second Etali step (known flaky). r19a 403/403 checks alone; under four parallel streams 3 late cases (Captivating Vampire, Piper of the Swarm, Sliver Overlord) time out and pass alone. New: r19a 99 cases, r19b 70, r19c 53, r19d 71, r20t 2 (custom Equipment tokens are not creatures; "named Sword" is honoured — found by the bot games). **Bot games on v20: 24 games (12 four-player, 12 two-player), 498 turns — 0 errors, 0 desyncs, 0 stuck;** the only real report was the Sword token, fixed. Regress baseline `/tmp/base_per.json` = v20 (7,000).

**Testing (v18):** 57 suites on the merged v18 file; all pass when run alone except r15's second Etali scenario (fails the same way on v16/v17, known flaky). New: r18a 38 (audit fixes), r18b 52 (losses, tokens, costs, P/T, numbers), r18c 75 (keyword lines, tokens, gaps). Test fixes: r2C waits for an empty stack before tapping Gilded Lotus; r2N picks an untapped Treasure; r2C3's Elsha step finds the Elves in any zone; r2D3 resets the transformed Aclazotz. **Bot games on the final file: 24 games (12 four-player, 12 two-player), 476 turns — 0 errors, 0 desyncs, 0 stuck, 0 real violations** (the only reports were players who lost leaving the game in multiplayer, a Platinum Angel player correctly not losing, and a phased-out card — all correct; fuzz.js now knows the first). Regress baseline `/tmp/base_per.json` = v18 (7,000).

**Testing (v17):** 54 suites on the merged v17 file. All pass except r15's second Etali scenario, which fails the same way on v16 (the turn passes mid-test; flagged flaky since v12; the same Etali poison rule passes in r2A). r2T, r2B and rfinal (33/33) failed only under four parallel streams and passed alone. New: r2A3 62, r2B3 40, r2C3 85, r2D3 63, r2E3 60, r2F3 (F's own run: 62 + the fixed Duskwatch step 9/9). r2D3's Hydaelyn step now resets an Aclazotz that correctly returned as Temple of the Dead. Regress baseline `/tmp/base_per.json` = v17 (7,000).

**Testing (v16):** all 49 suites pass on the merged v16 file (r10, r2K, r2E, r2Z, r2A2 needed a solo re-run after load flakes in the four-stream run). New: r2X 40, r2SP 43, r2Y 47, r2Z 96, r2A2 90, r2B2 39, r2C2 69. Regress baseline `/tmp/base_per.json` = v16 (6,858).

**Testing (v15):** all 41 suites pass on the merged v15 file in one four-stream run, including rfinal 33/33, r2R 36, r2S 61 (3 players), r2T 42, r2U 54, r2V 45, r2W 48. canBlock/canAttack contract: return a reason string to forbid, '' to allow — never `false`. Regress baseline `/tmp/base_per.json` = v15 (6,648).

**Testing (v14):** every suite passes on the v14 file when run alone, including the six new helper tests r2L 32, r2M 42, r2N 48, r2O 30, r2P 46, r2Q 56, plus rfinal 33/33. Under four parallel streams rfinal and r2H flaked once and passed alone. Regress baseline `/tmp/base_per.json` is now v14 (6,366).

**Testing (v13):** every suite passes on the v13 file when run on its own: run 64, r2 24, r3 17, r4 26, r5 8, r6 13, r7 23, r8 25, r9 41, r10 21, r11 3, r12 2, r12b 29, r14 6, rlobby 6, rdeck 15, rfinal 33 (4 players), r2A 21, r2B 45, r2C 38, r2D 27, r2E 47, r2F 49, r2G 41, r2H 54, r2I 43, r2J 60, r2K 45. Running four suites in parallel on one machine causes timing flakes (r6, r8, rfinal); re-run alone before treating a failure as real. The regress baseline `/tmp/base_per.json` is v12's; v13 = 5,922.

**Testing (v12):** all suites pass on the v12 file, plus `rlobby` (6), `rfinal` (33, 4 players), `rdecks` (rules check of the four decks), and the helpers' `r2A` (21), `r2B` (45), `r2C` (38 + `manaC.js` audit), `r2D` (27), `r2E` (47). Known flaky: r15's second Etali scenario (the turn passes mid-test; the same case passes in r2A) and r10's Korvold check under load. Test changes: r4 expects proliferate with no dialog; run.js and r2D tap all mana sources before "can't cast with a short pool" checks (auto-pay would pay otherwise); r7 opens the Deck check page first. `ALL=1` loads all 7,000 + `test/extra.json` (33 texts missing from all.json) into the mock Scryfall. Real decklists are in `decks/`.

**Testing (v11):** all 15 suites pass on the v11 build. `test/regress.py <per.json>` compares a mass-check result to the v10 baseline (`/tmp/base_per.json`) and lists regressions. r9's cast-trigger check waits up to 12 s (it was timing out under load).

**Testing (v10):** adds `r13` (mass check of 7,000 cards; prints coverage) and `r14` (Rhystic Study pay prompt on the other player's screen, Beast Within's token for the other player, devotion, Propaganda, Seedborn Muse). `build.py` takes `OUT=` and the tests take `PTFILE=` to check a dev build while the suites run.

**Testing (v9):** Playwright with mocked Scryfall/CDN and a local MQTT broker. 14 suites, all passing on 1 Nov:
- run (64), solo, r2 (24), combat (17), r4 (27), five-player (8), v4 (13), v5 (23), v6 (25), v7 (41), v8 commanders (21; also passes with the real texts), top-commander button (3).
- **r12** (checker over the 197 real texts: 188 understood).
- **r12b** (27 checks playing the new mechanics with real text: short names, Vivi, Sauron's amass and the Ring, Kefka and Y'shtola life loss, Omnath's three landfalls, Shorikai's crew, earthbend, firebending, Esika, Lier, Felothar, reflexive triggers, Atraxa, explore, Wan Shi Tong, Auntie Ool, Magda).
- `TOP=1` loads `test/top.json` into the mock Scryfall.

---

## 3. Rules decisions

### Agreed with Georges
All earlier decisions; strict play; passive text applies automatically; work through unread cards from checker reports; target the most-played Commander and Duel Commander commanders first (1 Nov); Claude may use Georges's built-in browser to look things up (1 Nov).

### Claude's calls (Georges to confirm)
- **Mana:** firebending mana stays for the whole combat phase.
- **v12 calls:** proliferate picks automatically (yours and player counters where they help you, opponents' where they hurt); "distribute N counters" splits evenly; "move any number of counters" moves all; auto-pay is on by default and pays attack taxes as soon as you declare; Static/Winter Orb ask the player which permanents to untap.
- **v18–v20 calls:** with 2 players a loss ends the game but keeps the table open (the life buttons can take a 0-life loss back); Marchesa counts combat damage during your own previous turn; Kefka's draw tops up if an opponent discards late; tapping by hand is still allowed (only untapping is restricted).
- Now enforced instead of a call: the Ring levels 1 and 3, Kefka's type count, opponent choices on their own screen (Kroxa, Acererak, Tasigur), crew until end of turn, Dargo's cost shown first, earthbend's return.
- Earlier calls unchanged.

---

## 4. Build plan

| Round | Scope | Status |
|---|---|---|
| 1–4 | Rules engine | Done 31 Oct 2026 |
| v4–v7 | Card reading, strict play, statics, big gaps, the known list | Done 1 Nov 2026 |
| v8 | Mechanics of the most-played commanders + top-commander check | Done 1 Nov 2026 |
| v9 | Real Oracle text of the top 197; 188 understood | Done 1 Nov 2026 |
| v10 | Mass check of the top 7,000; top 1,000 at 86% | Done 2 Nov 2026 |
| v11 | Helpers in parallel: top 2,000 at 84%, all 7,000 at 68% | Done 2 Nov 2026 |
| v12 | Full automation wave (5 helpers), lobby fix, pages, auto-pay, 4-player stax test | Done 2 Nov 2026 |
| v13 | Six helpers on the 7,000 tail (86% of 7,000, top 300 100%), deck editor and deck test | Done 2 Nov 2026 |
| v14 | Six engine families: copies, stack, costs/mana, layers, replacements/combat, events/rare mechanics (92% of 7,000) | Done 3 Nov 2026 |
| v15 | Doublers, ability sharing, cross-player protocols, companions and deck legality, the tail (96% of 7,000) | Done 3 Nov 2026 |
| v16 | SBA audit incl. legend rule, speed, Rooms and remaining mechanics, linked exile, tail (98% of 7,000; top 4,000 at 100%) | Done 3 Nov 2026 |
| v17 | The last 142 cards (6 helpers): all 7,000 fully understood | Done 5 Nov 2026 |
| v18 | Debugging: code audit + bot-game fuzzer; 30+ bugs fixed (losses, desync caps, info leaks, tokens, costs, P/T) | Done 6 Nov 2026 |
| v19 | No free face-down cards; untapping by hand only undoes an unspent mana tap | Done 6 Nov 2026 |
| v20 | Taking opponents' cards (gain/exchange control, steal); every older known gap (GAPS19, 36 items) | Done 6 Nov 2026 |
| v21 | The problems left after v20: right-time choices, the rest of the steal cards, Mindslaver abilities, ~40 graveyard-target cards, test reliability | Done 7 Nov 2026 |
| v22 | Intervening-if triggers (293); bots Easy/Intermediate + Hard/Very hard (beta), 1v1 and pods, offline; built-in trainer | Done 8 Nov 2026 |
| v23 | Master bot (beta), optional Claude coach, 35 cards from the bot games, damage-trigger / sync / token-speed fixes | Done 9 Nov 2026 |
| v24 | 500 bot games over 506 decks; 42 cards fixed | Done 10 Nov 2026 |
| v30 | Deck Workshop: animated Edit & test page with a Higgsfield video header, Build / Deck / Test tabs, visual deck area | Done 18 Nov 2026 |
| v29 | New look (Higgsfield art), animations and pop-ups, Ask about your cards (Scryfall + optional Claude) | Done 17 Nov 2026 |
| v28 | Loops work: the table asks how many times as a known loop starts; 98 of the 150 most-played combos tested, all 98 work; never decks you; mid-stack repeats, trigger ordering, counter loops | Done 17 Nov 2026 |
| v27 | Bug hunt: false loop questions, combo memory reset, Foray of Orcs, Pack Leader, token stacks | Done 13 Nov 2026 |
| v26 | Every loop asks how many times (hand loops spotted automatically, trigger loops at 20); 1,000 most-played combos memorised | Done 13 Nov 2026 |
| v25 | 33 infinite-combo lines tested; Oracle wins, wins end the game, drain loops stop, Power Artifact, Vizier/Melira, escape, self-mill, copies | Done 10 Nov 2026 |
| Next | Real-game feedback; measure bot strength over many decks | — |

**Known gaps (after v30):** Higgsfield artwork and the Deck Workshop video load from Higgsfield's CDN, so they need internet (fall back to the still banner / old look); r19d's Acererak sacrifice test times out (older than v29, not looked into yet); unknown hand loops are spotted only after two times round; when a known trigger loop asks at its first trigger, the first round's targets are still yours to choose (then reused); "a number of times" can come out one short for two-card trigger loops (Scurry Oak + Rosie: 9 of 10); combo deck counts for five colour pairs are estimates; one unreproduced stall during a Vito + Bloodthirsty Conqueror loop under heavy load; one unexplained land-creature attack the turn it entered; Hard / Very hard / Master aren't yet clearly stronger than the level below (all beta); the Claude coach's browser access may be blocked by an organisation's API settings (untested with Georges's key); bots can't foresee mass pumps; pods of control decks often reach the turn cap; bots slow down in a background browser tab; Firefox untested for bots; Staff of Eden targets at resolution; the Mindslaver panel can't show whether a controlled player's hand ability is affordable; one unreproduced Invoke Calamity exile duplicate under heavy machine load.
---

## 5. Ideas parked for later
- Buy list of cards actually drawn and played.
- Phone play: host the file on a free link (e.g. Netlify).
- Click-to-target on the table; drag Equipment and Auras onto creatures.

## v31.1 — Sound
- Table foley (draw, play, cast, tap, shuffle, counter coins, dice, life, attack, turn, hit, token, win, lose) plus two calm tavern music pieces, served from the site's /sounds/.
- 🔊 button and Game menu → "Sound & music volume…": separate on/off and volume for effects and music, saved in the browser.

## v32 — Phone and quick actions
- Phone layout (≤760px): one-row top bar, compact phase bar, slim opponent rows, creatures first then other permanents then lands, hand docked at the bottom, log behind a "Log" button, menus as bottom sheets.
- Mana abilities with several colours show colour buttons directly in the card menu (one tap for Lotus Petal and similar).
- Quick tap / double-click on a permanent with one non-mana {T} ability (fetch lands) activates it instead of just tapping.
- Ghost-tap guard on touch only: the tap that opens a menu cannot also press a button in it.
