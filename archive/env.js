// /usr/bin/jsub -N cron-tools.cewbot-env -once -quiet /usr/bin/node /data/project/cewbot/wikibot/archive/env.js

/*

 2016/6/8 20:32:14

 */

'use strict';

console.log('============================================================================');
console.log((new Date).toISOString());
console.log(global);

console.log('------------------------------------------------------------');
console.log(process);
console.log(process.env);

// Load CeJS library and modules.
require('./wiki loder.js');

console.log('--------------------------------------------------------------------------------');
console.log('CeJS loaded');
console.log(global);
