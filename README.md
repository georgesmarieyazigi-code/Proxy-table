# Proxy Table

A browser table for playtesting Magic: The Gathering Commander decks with friends before buying the cards.

**Play:** https://georgesmarieyazigi-code.github.io/Proxy-table/ (the `gh-pages` branch holds the built file).

- `src/` the game's source, joined into one HTML file by `build.py` (`OUT=proxy-table.html python3 build.py`)
- `test/` Playwright tests (local MQTT broker; Scryfall mocked unless `REAL=1`)
- `ci.sh` + `.github/workflows/playtest.yml` run tests on GitHub with real Scryfall; results go to the `results` branch
