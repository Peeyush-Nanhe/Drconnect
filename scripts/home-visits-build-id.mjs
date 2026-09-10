import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function homeVisitsBuildId() {
  const hash = createHash('sha256');
  function add(path) {
    hash.update(path).update('\0').update(readFileSync(path)).update('\0');
  }
  function directory(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) directory(child);
      else if (entry.isFile()) add(child);
    }
  }
  directory('src');
  directory('staging/supabase/migrations');
  add('package.json');
  add('package-lock.json');
  return hash.digest('hex');
}
