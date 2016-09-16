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
		import_data();
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
			import_data();
		} else {
			throw 'Can not get file [' + TaiBNET_CSV_path + ']: exit code '
					+ exit;
		}
	});
}

var 物種中文名_index,
// 學名 scientific name
taxon_name_index,
//
臺灣物種名錄物種編號_index = 0, 臺灣物種名錄物種編號_accepted_index;

function import_data() {
	CeL.run('data.CSV');
	var all_taxon_data = CeL.parse_CSV(CeL.get_file(TaiBNET_CSV_path), {
		has_title : true,
		skip_title : true
	});
	CeL.log('import_data: [' + TaiBNET_CSV_path + ']: ' + all_taxon_data.length
			+ ' lines.');

	// cache indexes
	物種中文名_index = all_taxon_data.index.common_name_c;
	taxon_name_index = all_taxon_data.index.name;
	臺灣物種名錄物種編號_accepted_index = all_taxon_data.index.accepted_name_code;

	all_taxon_data.slice(0, 80).forEach(for_taxon);
}

// 因為數量太多，只好增快速度。
CeL.wiki.query.default_lag = 0;

function for_taxon(line) {
	var TaiBNET_id = line[臺灣物種名錄物種編號_index] || line[臺灣物種名錄物種編號_accepted_index],
	// Chinese name of the species
	物種中文名 = line[物種中文名_index],
	// scientific name
	taxon_name = line[taxon_name_index];
	if (!TaiBNET_id || !taxon_name || !(taxon_name = taxon_name.trim())
	//
	|| !物種中文名 || !(物種中文名 = 物種中文名.trim())) {
		CeL.debug('Skip #' + TaiBNET_id + ': ' + taxon_name + ', ' + 物種中文名, 1,
				'for_taxon');
		// console.log(line);
		return;
	}

	CeL.info('for_taxon: ' + taxon_name + ': ' + 物種中文名);
	// console.log(line);
	wiki.data([ 'en', taxon_name ], function(wiki_entity) {
		// console.log(wiki_entity);
	}).edit_data(function(wiki_entity) {
		if (!wiki_entity) {
			return;
		}
		return {
			生物俗名 : 物種中文名,
			language : 'zh-tw',
			references : {
				臺灣物種名錄物種編號 : TaiBNET_id,
				檢索日期 : new Date
			}
		};
	}, {
		bot : 1,
		summary : 'bot test: import data from TaiBNET #' + TaiBNET_id
	});
}
