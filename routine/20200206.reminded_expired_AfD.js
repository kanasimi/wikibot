/*

2020/2/6	擷取redirect_to,logs,discussions三項資訊
2020/2/8 17:19:57	增加報告
	初版試營運

TODO:

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

prepare_directory(base_directory, true);

// ----------------------------------------------


// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	//await for_AfD('Wikipedia:Articles for deletion/Quintana Olleras');
	//await for_AfD('Wikipedia:Articles for deletion/Michael Breslin Murphy');
	//await for_AfD('Wikipedia:Articles for deletion/Andy Duncan (musician)');

	const AfD_page_title = 'Wikipedia:Articles for deletion/Log/2020 February 3';

	const list_page_data = await wiki.page(AfD_page_title);
	const parsed = list_page_data.parse();
	const discussion_title_list = [];
	parsed.each('transclusion', token => {
		const discussion_page_title = token.name;
		const matched = discussion_page_title.match(/^Wikipedia:Articles for deletion\/([^\/]+)$/);
		if (matched) {
			//discussion_title_list.push(matched[1]);
			discussion_title_list.push(discussion_page_title);
		}
	});
	//console.log(discussion_title_list);
	const all_report_lines = [];
	await wiki.for_each_page(discussion_title_list, for_AfD, { all_report_lines });
	console.log(all_report_lines);
	await wiki.edit_page('Wikipedia:Sandbox', `{{Please leave this line alone (sandbox heading)}}\n\n== Report for ${CeL.wiki.title_link_of(AfD_page_title)} ==\n\n${all_report_lines.join('\n\n')}`);
}

// ----------------------------------------------------------------------------

const now = new Date;

function to_timestamp(log) {
	let date = log.timestamp;
	if (date) {
		date = new Date(date);
		if (false && now.getFullYear() - date.getFullYear() > 1)
			return date.getFullYear();
		return date.format('%Y-%2m');
	}
	console.error(log);
	throw new Error('Can not ertract timestamp!');
}

async function for_AfD(page_data) {
	const parsed = page_data.parse();
	let page_title;
	parsed.each('template', token => {
		//Wikipedia:Articles for deletion/Quintana Olleras
		if (token.name === 'La') {
			page_title = token.parameters[1];
			if (page_title)
				return parsed.each.exit;
		}
	});
	if (!page_title) {
		//[[Wikipedia:Articles for deletion/Michael Breslin Murphy]]
		parsed.each('section_title', token => {
			if (token.some(_token => {
				if (_token.type === 'link')
					return page_title = _token[0].toString();
			})) {
				return parsed.each.exit;
			}
		});
	}
	if (!page_title) {
		CeL.error(`for_AfD: Can not extract page title: ${CeL.wiki.title_link_of(page_data)}`);
		return;
	}

	const article_page_data = await wiki.page(page_title);
	//console.log(article_page_data);
	if ('missing' in article_page_data)
		return;

	let result_notice = `* '''Note to closer''': From lack of discussion, this nomination appears to have [[WP:NOQUORUM|no quorum]]. It seems no previous PRODs, previous AfD discussions, previous undeletions, or a current redirect, so this nomination appears to be eligible for [[WP:SOFTDELETE|soft deletion]] at the end of its seven-day listing.`;
	const report_lines = [];

	// -------------------------------------------------------

	const discussions = [];
	(await wiki.linkshere(page_title, { namespace: 'Wikipedia' }))
		.forEach(async discussion_page => {
			if (discussion_page.title.startsWith('Wikipedia:Articles for deletion/')
				? discussion_page.title === page_data.title || discussion_page.title.startsWith('Wikipedia:Articles for deletion/Log/')
				: !discussion_page.title.startsWith('Wikipedia:Requests for undeletion')) {
				return;
			}

			const discussion_page_data = await wiki.page(discussion_page);
			/**
			 * <code>
			
			[[Wikipedia:Articles for deletion/Michael Breslin Murphy]]
			The result was '''Merge''' and '''redirect''' to [[Break (music)]].
			[[Wikipedia:Articles for deletion/Kevin cooper]]
			The result of the debate was '''SPEEDY DELETE'''.
			[[Wikipedia:Articles for deletion/Golden age hip hop]]
			The result of the debate was '''keep, nomination withdrawn'''.
			[[Wikipedia:Articles for deletion/Evolución (band)]]
			The result was '''keep'''.
			
			</code>*/
			let result = discussion_page_data.wikitext.match(/The result .+? '''(.+?)'''./);
			if (!result || !(result = result[1])) {
				return;
			}
			result_notice = `* '''Note to closer''': While this discussion appears to have [[WP:NOQUORUM|no quorum]], it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it was [[${discussion_page}|previously discussed at AfD]] and the result was ${result}.`;

			//console.log(discussion_page_data);
			//console.log(result);
			discussions.push(`${to_timestamp(discussion_page_data.revisions[0])} ${CeL.wiki.title_link_of(discussion_page_data, result)}`);
		});
	if (discussions.length > 0) {
		report_lines.push('previous discussions: ' + discussions.join(', '));
	}

	// -------------------------------------------------------

	const logs = [];
	let log_note;
	(await wiki.logevents(page_title)).forEach(log => {
		//console.log(log);
		let log_text;
		switch (log.action) {
			case 'move':
				//type: 'move'
				log_text = `${to_timestamp(log)} move to → ${log.params && log.params.target_title && CeL.wiki.title_link_of(log.params.target_title) || 'moved'}`;
				break;
			case 'delete':
				//type: 'delete'
				const is_PROD = log.comment && log.comment.includes('PROD');
				log_text = `${to_timestamp(log)} ❌ deleted` + (is_PROD ? ' (PROD)' : '');
				if (!log_note)
					log_note = `* '''Note to closer''': While this discussion appears to have [[WP:NOQUORUM|no quorum]], it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it has been [{{fullurl:Special:Log|page={{urlencode:${page_title}}}}} previously ${is_PROD ? "PROD'd" : 'deleted'}].`;
				break;
			case 'restore':
				//type: 'delete'
				log_text = `${to_timestamp(log)} [[File:Gnome-undelete.svg|20px]] restored`;
				log_note = `* '''Note to closer''': While this discussion appears to have [[WP:NOQUORUM|no quorum]], it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it was [{{fullurl:Special:Log|page={{urlencode:${page_title}}}}} previously undeleted (${new Date(log.timestamp).toLocaleDateString('en-US', { dateStyle: "medium" })})].`;
				break;
			case 'delete_redir':
				//type: 'delete'
				break;
		}
		if (log_text) {
			logs.push(log_text);
		}
	});
	if (log_note) {
		result_notice = log_note;
	}
	//console.log(logs);
	if (logs.length > 0) {
		//[{{fullurl:Special:Log|page=}} logs]
		report_lines.push('logs: ' + logs.join(', '));
	}

	// -------------------------------------------------------

	const redirect_to = CeL.wiki.parse.redirect(article_page_data);
	//console.log(redirect_to);
	if (redirect_to) {
		result_notice = `* '''Note to closer''': While this discussion appears to have [[WP:NOQUORUM|no quorum]], it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because the subject is currently redirecting to ${CeL.wiki.title_link_of(redirect_to)}.`;
		report_lines.push(`current redirect ↪ ${CeL.wiki.title_link_of(redirect_to)}`);
	}

	// -------------------------------------------------------

	if (report_lines.length === 0)
		return;

	CeL.info(`=== ${CeL.wiki.title_link_of(page_data)} ===`);
	report_lines.unshift(result_notice);
	CeL.log(report_lines.join('\n: '));
	console.log(this.all_report_lines === all_report_lines);
	this.all_report_lines.push(report_lines.join('\n: '));
	//await wiki.edit_page(page_data, page_data.wikitext.replace(//));
}
