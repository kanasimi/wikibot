// cd ~/wikibot && date && time node test_fs.ReadStream.js
// test: 一個字元可能被切分成兩邊，這會造成錯誤的編碼?

/*

 2016/3/26 6:52:8	初版試營運

 */

'use strict';

// require('./wiki loader.js');
// for CeL.wiki.cache(), CeL.fs_mkdir()
// CeL.run('application.platform.nodejs');

var node_fs = require('fs'), filename = 'test',
//
buffer = '',
//
file_stream = new node_fs.createReadStream(filename, { start: 0 }),
// 掌握進度用。 (100 * status.pos / status.size | 0) + '%'
// 此時 stream 可能尚未初始化，(file_stream.fd===null)，
// 因此不能使用 fs.fstatSync()。
// status = node_fs.fstatSync(file_stream.fd);
status = node_fs.statSync(filename);
// 若是預設 encoding，會造成 chunk.length 無法獲得正確的值。
// 為了能掌握進度，因此不預設 encoding。
//file_stream.setEncoding('utf8');
status.pos = 0;

var bin;
file_stream.on('data', function(chunk) {
	// console.log(JSON.stringify(file_stream));
if(!bin)
bin=chunk;
else
bin=Buffer.concat([bin,chunk]);

//console.log(bin);
var index=bin.indexOf('<page');
if(index===-1)
return;


console.log();
buffer += bin.slice(0,index).toString('utf8');
	status.pos += index;
bin=bin.slice(index);

	/**
	 * 當未採用 .setEncoding('utf8')，之後才 += chunk.toString('utf8')；
	 * 則一個字元可能被切分成兩邊，這會造成破碎/錯誤的編碼。
	 * 
	 * This properly handles multi-byte characters that would otherwise be
	 * potentially mangled if you simply pulled the Buffers directly and called
	 * buf.toString(encoding) on them. If you want to read the data as strings,
	 * always use this method.
	 * 
	 * @see https://nodejs.org/api/stream.html#stream_class_stream_readable
	 */
//	buffer += chunk.toString('utf8');
	// buffer += chunk;

	// buffer = buffer.slice(buffer.length - 8);
	buffer = buffer.replace(/[處理朱載]+/g, '');

	console.log('[' + buffer.replace(/\n/g, '\\n') + '] ends '
			+ buffer.charCodeAt(buffer.length - 1) + ', ' + status.pos + '/'
			+ status.size);
});

file_stream.on('end', function() {
buffer += bin.toString('utf8');
buffer = buffer.replace(/[處理朱載]+/g, '');
console.log(buffer);
	console.log(status);
});

