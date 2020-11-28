'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

const KITLV_to_item_id_hash = Object.create(null);

async function get_item_ids() {
	const wiki = new Wikiapi('commons');
	const page_data = await wiki.page('User:Hansmuller/List of KITLV shelfmarks and permanent item numbers');
	page_data.wikitext.split(/\n/).forEach(line => {
		//console.log(line);
		const matched = line.match(/^KITLV (\w{2,7})\s+item:(\d{6})/);
		if (matched) {
			KITLV_to_item_id_hash[matched[1]] = matched[2];
		} else if (line.startsWith('KITLV')) {
			console.log(line);
		}
	});
}

(async () => {

	await get_item_ids();

	//console.log(KITLV_to_item_id_hash);
	CeL.info(Object.keys(KITLV_to_item_id_hash).length + ' ids loaded.');

	await replace_tool.replace({
		language: 'commons',
	}, {
		'http://media-kitlv.nl/all-media/indeling/detail/form/advanced': {
			namespace: 'File',
			text_processor(wikitext, page_data) {
				/** {Array} parsed page content 頁面解析後的結構。 */
				const parsed = page_data.parse();
				let changed;
				parsed.each('url', (token, index, parent) => {
					if (typeof token[0] !== 'string')
						return;
					const KITLV = + token[0].between('http://media-kitlv.nl/all-media/indeling/detail/form/advanced?q_search_signatuur=');
					if (!KITLV)
						return;
					//console.log(token);
					//console.log(KITLV_to_item_id_hash[KITLV]);
					if (!KITLV_to_item_id_hash[KITLV]) {
						CeL.warn(`Invalid KITLV id: ${KITLV}`);
						return;
					}

					token[0] = 'http://hdl.handle.net/1887.1/item:' + KITLV_to_item_id_hash[KITLV];
					delete KITLV_to_item_id_hash[KITLV];
					changed = true;
				});

				if (changed)
					return parsed.toString();
			},

		},
	});

	CeL.info(Object.keys(KITLV_to_item_id_hash).length + ' ids left.');
})();
