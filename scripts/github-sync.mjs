import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mode=process.argv[2] ?? 'status';
function git(...args) { return execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/').replace(/\/$/,'')}`,...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000}).trim(); }
try {
  if(!['status','pull','push'].includes(mode)) throw Error('Use status, pull or push.');
  if(git('remote','get-url','origin')!=='https://github.com/Peeyush-Nanhe/Drconnect.git') throw Error('Expected the Drconnect origin; review before syncing.');
  if(git('branch','--show-current')!=='main') throw Error('Sync only operates on main.');
  git('fetch','origin');
  const dirty=git('status','--porcelain=v1').length>0;
  const [ahead,behind]=git('rev-list','--left-right','--count','HEAD...origin/main').split(/\s+/).map(Number);
  if(mode==='status') console.log(JSON.stringify({branch:'main',ahead,behind,uncommittedChanges:dirty}));
  else {
    if(dirty) throw Error('Local edits are unfinished. Commit/review them before syncing; no files were overwritten.');
    if(ahead && behind) throw Error('Local and GitHub commits diverged. Review and merge before syncing.');
    if(mode==='pull') console.log(behind ? git('merge','--ff-only','origin/main') : 'No GitHub changes to pull.');
    else {
      if(behind) throw Error('GitHub has new commits. Pull and validate them before pushing.');
      console.log(ahead ? git('push','origin','HEAD:main') : 'No committed local changes to push.');
    }
  }
} catch(error) { console.error(error.message); process.exitCode=1; }
