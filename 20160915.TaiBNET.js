// (cd ~/wikibot && date && hostname && nohup time node 20160915.TaiBNET.js; date) >> TaiBNET/log &

/*

 2016/9/15 12:23:53	初版
 上路


 */

'use strict';

// Load CeJS library and modules.
require('./wiki loder.js');

var
/** {Object}wiki operator 操作子. */
wiki = Wiki(true);

var TaiBNET_CSV_path = base_directory + 'TaiwanSpecies_UTF8.'
		+ (new Date).format('%Y%2m%2d') + '.csv';

try {
	var node_fs = require('fs');
	// check if file exists
	if (node_fs.statSync(TaiBNET_CSV_path)) {
		main_work();
	}
} catch (e) {
	// console.error(e);
	// throw e;

	var spawn = require('child_process').spawn, get_TaiBNET_file = spawn(
			'/usr/bin/wget',
			[
					'--output-document=' + TaiBNET_CSV_path + '',
					// http://taibnet.sinica.edu.tw/chi/taibnet_xcsv.php?R1=name&D1=&D2=&D3=&T1=&T2=%25&id=&sy=y&pi=&da=
					'http://taibnet.sinica.edu.tw/chi/taibnet_xcsv.php?R1=name&D1=&D2=&D3=&T1=&T2=%25&id=&sy=y&pi=&da=' ]);

	get_TaiBNET_file.stdout.on('data', function(data) {
		// console.log(data.toString());
	});

	get_TaiBNET_file.stderr.on('data', function(data) {
		// console.error(data.toString());
	});

	get_TaiBNET_file.on('close', function(exit) {
		if (exit === 0) {
			main_work();
		} else {
			throw 'Can not get file [' + TaiBNET_CSV_path + ']: exit code '
					+ exit;
		}
	});
}

function main_work() {
	CeL.run('data.CSV');
	var all_taxon_data = CeL.parse_CSV(CeL.get_file(TaiBNET_CSV_path), {
		has_title : true,
		skip_title : true
	});
	CeL.log('main_work: [' + TaiBNET_CSV_path + ']: ' + all_taxon_data.length
			+ ' lines.');

	var 物種中文名_index = all_taxon_data.index.common_name_c,
	// 學名
	taxon_name_index = all_taxon_data.index.name;

	all_taxon_data.slice(0, 2).forEach(for_taxon);
}

function for_taxon(line) {
	var 物種中文名 = line[物種中文名_index],
	//
	taxon_name = line[taxon_name_index];
	if (!taxon_name || !(taxon_name = taxon_name.trim())
	//
	|| !物種中文名 || !(物種中文名 = 物種中文名.trim())) {
		return;
	}

	CeL.info('for_taxon: ' + taxon_name + ': ' + 物種中文名);
	wiki.data(taxon_name, function(wiki_entity) {
		// console.log(wiki_entity);
	}).edit_data(function(entity) {
		return {
			生物俗名 : 物種中文名,
			language : 'zh-tw',
			references : {
				臺灣物種名錄物種編號 : line[0],
				檢索日期 : new Date
			}
		};
	}, {
		bot : 1,
		summary : 'bot test: edit {{P|1843}}'
	});
}
