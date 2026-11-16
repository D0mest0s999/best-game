// Orbital Salvage — hand-in program for the best-game-01 bounty.
//
// The game itself is the static site under game/ (plain ES modules, no
// build step, nothing fetched). This program copies game/ and
// screenshots/ into the output directory and writes dossier.json with
// the vendored make.fun library, under the same caps the scorer uses,
// so what is handed in is exactly what gets judged.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's own caps (from the kit's gate reference): the text cap
// shapes the dossier bytes; the rest refuse anything the scorer would
// refuse — too many screenshots, one over 256 KiB, a game/ tree past
// 993 entries or 48 MiB, or a path under game/ past 1000 bytes.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
const shotsDir = join(here, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, GATE));

console.log(`Orbital Salvage handed in: game/ + screenshots/ copied to ${out}, dossier.json written.`);
