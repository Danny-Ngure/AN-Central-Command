// Side-effect-only module: loads `.env.local` BEFORE any importer evaluates
// modules that read process.env at init time (notably @an/db's client.ts).
//
// ES modules evaluate dependencies depth-first in source order, so importing
// this file FIRST in a script guarantees process.env is populated before any
// subsequent `import` runs.
import { config } from 'dotenv';

config({ path: '.env.local' });
