// cd /data/project/cewbot/wikibot && node process_dump.js

/*

 2016/3/12 11:56:10	初版試營運
 上路前修正
 完善

 */

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
CeL.run('application.platform.nodejs');

var start = Date.now(), count = 0,
//
file_stream = CeL.wiki.read_dump(function(page_data) {
	if (++count % 10000 === 0)
		CeL.log(count + ': ' + (count / (Date.now() - start)).toFixed(3)
				+ ' page/ms\t' + page_data.title);
	if (!page_data.title)
		CeL.warn('* No title: [[' + page_data.id + ']]');
	// [[Wikipedia:快速删除方针]]
	if (!page_data.revisions[0]['*'])
		CeL.warn('* No content: [[' + page_data.title + ']]');
}, {
	directory : bot_directory + 'dumps/',
	last : function() {
		CeL.log('All ' + count + ' pages, ' + (Date.now() - start) / 1000
				+ ' s.');
	}
});
