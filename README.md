# MALECÓN — Costa Verde

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01&ref=cav57xya)

An original open-world crime game in the spirit of GTA 6, running in a desktop
browser from plain static files with no build step. **Puerto Celeste** is a
sun-soaked island city of its own: nine jobs, one causeway grid, a beach crescent,
a dry dock, a hilltop chapel and an observatory, with traffic, pedestrians, cars
you can steal, a five-star wanted level, cruisers that ram you and a helicopter
with a searchlight.

Nothing here is Rockstar's: the city, the names, the nine jobs, the vehicles and
the art are all drawn from three.js primitives and canvas textures at run time.

## Play it

```sh
node serve.mjs            # http://localhost:8123
```

`W A S D` move / drive · `SHIFT` sprint · `E` grab or leave a car · `M` map ·
`F1` save · `ESC` pause. Mouse looks around.

## How it is built

| file | what it does |
|---|---|
| `game/index.html` | the page, the HUD markup, the title and pause screens |
| `game/src/main.js` | the loop: input, player and car physics, camera, jobs, HUD, minimap, saving |
| `game/src/city.js` | builds the island: grid, blocks, palms, pier, docks, helipad, hills, beach, sky |
| `game/src/actors.js` | cars, pedestrians, the player, and their walk/drive cycles |
| `game/src/police.js` | the wanted level, cruisers that pursue, the helicopter, the dispatch list |
| `game/src/world-data.js` | the city constants, the nine jobs, the named places, the spawns |
| `game/src/input.js` | keyboard and mouse |
| `game/src/hud.css` | the HUD: mission card, wanted rack, dispatch, minimap, speedometer |

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
with the kit's own `buildDossier`. Three screenshots in `screenshots/` are real
renders of the game's own code, taken from a browser, first one is the cover.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cav57xya&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
