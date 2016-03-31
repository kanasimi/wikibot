// cd ~/wikibot && date && time ../node/bin/node count_dump.js && date

/*

 2016/3/28 18:55:37	初版試營運

 */

'use strict';

// require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
// CeL.run('application.platform.nodejs');

var node_fs = require('fs'), filename = 'dumps/zhwiki-20160305-pages-articles.xml',
//
file_stream = new node_fs.ReadStream(filename),
//
start_time = Date.now(), stage = 0,
//
characters = 0, bytes = 0;
file_stream.setEncoding('utf8');

file_stream.on('data', function(chunk) {
	characters += chunk.length;
	bytes += Buffer.byteLength(chunk);
	if (bytes >= stage) {
		stage += 1e8;
		console.log([characters, bytes, (Date.now()-start_time)/1000|0]);
	}
});

file_stream.on('end', function() {
	// [ 4177457483, 5627045001, 133 ]
	console.log([characters, bytes, (Date.now()-start_time)/1000|0]);
});
