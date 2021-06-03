/*


 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run(['application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const Thai_people_category__template_name = 'Thai people category';
const summary_prefix = '[[Wikipedia:Bots/Requests for approval/Cewbot 7|Maintaining sort keys in Thai-people categories]]: ';

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {

	await read_Thai_name_table();

	const pages_to_check = [], length = Object.keys(Thai_name_data).length, login_user_name = wiki.append_session_to_options().session.token.login_user_name;
	let index = 0;
	for (const page_title of Object.keys(Thai_name_data)) {
		CeL.log_temporary(`${++index}/${length} ${page_title}`);
		const Thai_people_data = Thai_name_data[page_title];
		if (!Thai_people_data.DEFAULTSORT || Thai_people_data.DEFAULTSORT.toString().includes("don't change")) {
			continue;
		}
		const page_data = await wiki.page(Thai_people_data.page_title, { revisions: 20, rvprop: 'user|content|timestamp' });
		const revision_0 = CeL.wiki.content_of.revision(page_data, 0);
		if (!revision_0) {
			pages_to_check.push(page_data.title);
			continue;
		}
		if (revision_0.user !== login_user_name) {
			for (let index = 0; ;) {
				const revision = CeL.wiki.content_of.revision(page_data, ++index);
				if (!revision) {
					// assert: no more revision
					break;
				}
				if (revision.user === login_user_name) {
					if (Date.now() - Date.parse(revision_0.timestamp) < 24 * 60 * 60 * 1000) {
						CeL.warn(`${CeL.wiki.title_link_of(page_data)}: Edited by ${revision_0.user}`);
						pages_to_check.push(page_data.title);
					}
					break;
				}
			}
			continue;
		}
		const diff_list = CeL.LCS(CeL.wiki.content_of(page_data, 1), CeL.wiki.content_of(page_data, 0), {
			diff: true,
			// MediaWiki using line-diff
			line: true
		});
		if (diff_list.some(diff => /\[\[ *Category *:/i.test(diff[0]) && !/{{ *DEFAULTSORT *:/.test(diff[0]) && /{{ *DEFAULTSORT *:/.test(diff[1]))) {
			console.log([page_data.title, diff_list]);
			await wiki.edit_page(page_data, '', {
				undo: 1,
				bot: 1,
				minor: 1,
				summary: 'fix error made by bot'
			});
		}
	}

	console.trace(pages_to_check.map(page_title => '# ' + CeL.wiki.title_link_of(page_title)).join('\n'));
}


// ----------------------------------------------------------------------------

const do_not_check_redirects = true;

// Thai_name_data[Thai people page title] = { page_title:'', given_name:'', surname:'', DEFAULTSORT:'', Thai_sort_key:'' }
const Thai_name_data = Object.create(null);

// (excluding the disambiguator)
function page_title_to_sort_key(page_title) {
	// e.g., [[Abdoul Karim Sylla (footballer, born 1981)]] → "Abdoul Karim Sylla"
	return page_title.toString().replace(/ \([^()]+\)$/, '')
		// diacritics to alphabet
		// https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
		.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function read_Thai_name_table() {
	const list_page_data = await wiki.page('Wikipedia:WikiProject Thailand/Thai name sort keys');
	list_page_data.parse();
	//console.log(list_page_data.parsed);

	const Thai_name_table = CeL.wiki.table_to_array(list_page_data);
	Thai_name_table.forEach((line, index) => {
		if (!line[5] || index === 0)
			return;
		line[0] = line[0].replace(/^\[\[|\]\]$/g, '');
		if (line[5] === 'yes') {
			if (line[4] === line[3])
				line[4] = '';
			if (line[4])
				CeL.error(`${read_Thai_name_table.name}: Says Thai sort (${line[4]}) = Default sort (${line[3]}) but they are not the same!`);
		} else {
			// assert: line[5] === 'no'
			if (!line[4])
				CeL.error(`${read_Thai_name_table.name}: Says Thai sort != Default sort (${line[3]}) but did not set Thai sort!`);
		}
		Thai_name_data[line[0]] = {
			page_title: line[0],
			given_name: line[1],
			surname: line[2],
			DEFAULTSORT: line[3],
			Thai_sort_key: line[4]
		};
	});

	if (do_not_check_redirects) {
		CeL.warn(`${read_Thai_name_table.name}: Do not check redirects.`);
		return;
	}

	await wiki.register_redirects(Object.keys(Thai_name_data));
	Object.keys(Thai_name_data).forEach(listed_page_title => {
		const redirect_target = wiki.redirect_target_of(listed_page_title);
		if (redirect_target !== listed_page_title) {
			if (Thai_name_data[redirect_target])
				throw new Error(`Thai_name_data[${redirect_target}] existed`);

			CeL.warn(`${read_Thai_name_table.name}: ${CeL.wiki.title_link_of(listed_page_title)} → ${CeL.wiki.title_link_of(redirect_target)}`);
			(Thai_name_data[redirect_target] = Thai_name_data[listed_page_title])
				.page_title = redirect_target;
			delete Thai_name_data[listed_page_title];
		}

		if (false) {
			const data = Thai_name_data[redirect_target];
			if ((page_title_to_sort_key(data.page_title) === data.DEFAULTSORT) !== (data.DEFAULTSORT_equals_page_title === 'yes')) {
				CeL.error(`.DEFAULTSORT_equals_page_title of Thai_name_data[${redirect_target}] is not correct!`);
				console.error(data);
			}
			delete data.DEFAULTSORT_equals_page_title;
		}
	});

	//console.log(Thai_name_data);
}

// ----------------------------------------------------------------------------

