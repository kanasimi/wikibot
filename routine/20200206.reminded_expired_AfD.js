/*
node 20200206.reminded_expired_AfD.js days_ago=8

Assist administrators to close AfDs. Especially discussions without participants.
協助管理員關閉刪除討論。尤其是無參與者的討論。

2020/2/6	擷取redirect_to,logs,discussions三項資訊
2020/2/8 17:19:57	增加報告
2020/3/17 5:56:34	初版試營運

TODO:

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// Discussions are usually closed after seven days (168 hours).
const close_days = 7;

// prepare_directory(base_directory, true);

// ----------------------------------------------

// [ , page title to delete ]
const PATTERN_AfD_page = /^Wikipedia:Articles for deletion\/([^\/]+)$/;

// ----------------------------------------------------------------------------

(async () => {
	await wiki.login(user_name, user_password, use_language);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	if (false) {
		await for_AfD('Wikipedia:Articles for deletion/Quintana Olleras');
		await for_AfD('Wikipedia:Articles for deletion/Michael Breslin Murphy');
		await for_AfD('Wikipedia:Articles for deletion/Andy Duncan (musician)');

		for_AfD_list(await wiki.page('Wikipedia:Articles for deletion/Log/2020 February 1'));
	}

	let date = new Date();
	if (false) {
		// from 9 days ago
		date.setDate(date.getDate() - 9);
		for (let days = 0; days < 6; days++) {
			date.setDate(date.getDate() + 1);
			await process_AfD_date(date);
		}
	}

	date.setDate(date.getDate() - (CeL.env.arg_hash && CeL.env.arg_hash.days_ago || (close_days
		// +1: using 7+1 days to be sure there is full 7 days.
		+ 1)));
	await process_AfD_date(date);

	routine_task_done('1d');
}

// ----------------------------------------------------------------------------

async function process_AfD_date(date) {
	const AfD_list_page_title = `Wikipedia:Articles for deletion/Log/${date.format({ locale: 'en', format: '%Y %B %d' })}`;
	CeL.info(`Process ${CeL.wiki.title_link_of(AfD_list_page_title)}:`);
	await for_AfD_list(await wiki.page(AfD_list_page_title));
}

async function for_AfD_list(AfD_list_page_data) {
	// CeL.info(`${CeL.wiki.title_link_of(AfD_list_page_data)}: start:`);
	const parsed = AfD_list_page_data.parse();
	const main_page_title_list = [];
	const discussion_title_list = [];
	parsed.each('transclusion', token => {
		const discussion_page_title = token.name;
		const matched = discussion_page_title.match(PATTERN_AfD_page);
		if (matched
			// For only single AfD
			// && discussion_page_title.includes('Tok Nimol')
		) {
			main_page_title_list.push(matched[1]);
			discussion_title_list.push(discussion_page_title);
		}
	});
	// console.log(discussion_title_list);
	const page_data_hash = Object.create(null);
	await wiki.for_each_page(main_page_title_list, page_data => page_data_hash[page_data.title] = page_data, { no_edit: true });

	const all_report_lines = [];
	await wiki.for_each_page(discussion_title_list, for_AfD.bind({ all_report_lines, page_data_hash }), { no_edit: true });
	// console.log(all_report_lines);
	const report_wikitext = `
{{Please leave this line alone (sandbox heading)}}

== Report for ${CeL.wiki.title_link_of(AfD_list_page_data)} ==

{{see|Wikipedia:Bot requests#A heads up for AfD closers re: PROD eligibility when approaching NOQUORUM}}

${all_report_lines.join('\n\n')}
`;
	// CeL.info(`${CeL.wiki.title_link_of(AfD_list_page_data)}: write report:`);
	// console.log(report_wikitext);
	// await wiki.edit_page('Wikipedia:Sandbox', report_wikitext, { summary: 'Report for ' + CeL.wiki.title_link_of(AfD_list_page_data) });
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

// ----------------------------------------------------------------------------

function extract_target_page_of_AfD(AfD_page_data) {
	const parsed = AfD_page_data.parse();
	/** {String}target page title */
	let target_page_title;
	parsed.each('template', token => {
		// Wikipedia:Articles for deletion/Quintana Olleras
		// Wikipedia:Articles for deletion/Reem Al Marzouqi (2nd nomination)
		// Wikipedia:Articles for deletion/Race and intelligence 2
		// Wikipedia:Articles for deletion/Race and intelligence (4th
		// nomination)
		if (token.name === 'La') {
			target_page_title = token.parameters[1];
			if (target_page_title)
				return parsed.each.exit;
		}
	});
	if (!target_page_title) {
		// [[Wikipedia:Articles for deletion/Michael Breslin Murphy]]
		// [[Wikipedia:Articles for deletion/Race and intelligence]]
		parsed.each('section_title', token => {
			if (token.some(_token => {
				if (_token.type === 'link')
					return target_page_title = _token[0].toString();
			})) {
				return parsed.each.exit;
			}
		});
	}
	return target_page_title;
}

// TODO: check if there are participations.
function check_AfD_participations(AfD_page_data) {
	const participations = Object.create(null);
	// preserve sort
	check_AfD_participations.recommendation_types.forEach(type => { participations[type] = []; });
	participations[check_AfD_participations.type_others] = [];
	const parsed = AfD_page_data.parse();

	parsed.each('list', list_token => {
		list_token.forEach(token => {
			let recommendation = token.toString().match(/'''(.+?)'''/);
			if (!recommendation)
				return;
			recommendation = recommendation[1].toLowerCase().match(check_AfD_participations.PATTERN);
			if (recommendation in ignore_recommendations) {
				// Ignore the notes by bot it self.
				return;
			}
			participations[recommendation || check_AfD_participations.type_others].push(participations);
		});
	}, { level_filter: 1 });

	check_AfD_participations.recommendation_types.forEach(type => {
		if (participations[type].length === 0)
			delete participations[type];
	});
	if (!CeL.is_empty_object(participations))
		return participations;
}

// [[Wikipedia:Guide_to_deletion#Shorthands]]
check_AfD_participations.recommendation_types = 'keep|delete|merge|redirect'.split('|');
check_AfD_participations.type_others = 'misc';
check_AfD_participations.PATTERN = new RegExp(check_AfD_participations.recommendation_types.join('|'));

// ----------------------------------------------------------------------------

async function get_AfD_discussions(target_page_title, AfD_page_data) {
	const linkshere = await wiki.linkshere(target_page_title, { namespace: 'Wikipedia' });
	// CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: linkshere`);
	// console.log(linkshere);

	const discussion_page_list = [];
	for (let discussion_page_data of linkshere) {
		if (PATTERN_AfD_page.test(discussion_page_data.title)
			? AfD_page_data && discussion_page_data.title === AfD_page_data.title || discussion_page_data.title.startsWith('Wikipedia:Articles for deletion/Log/')
			: !discussion_page_data.title.startsWith('Wikipedia:Requests for undeletion')) {
			continue;
		}

		discussion_page_list.push(discussion_page_data);
	}
	// CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: discussion_page_list`);
	// console.log(discussion_page_list);
	if (discussion_page_list.length === 0)
		return;

	const previous_discussions = [], related_discussions = [];
	await wiki.for_each_page(discussion_page_list, discussion_page_data => {
		/**
		 * {String}page content, maybe undefined. 條目/頁面內容 =
		 * CeL.wiki.revision_content(revision)
		 */
		const content = discussion_page_data.wikitext;
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
		
		</code>
		 */
		let result = content.match(/The result .+? '''(.+?)'''/)
			// [[Wikipedia:Articles for deletion/Race and intelligence]]
			// "The result of the debate was KEEP\n"
			|| content.match(/The result .+? was (.+?)(?:\.[ \n]|\n)/);
		if (!result || !(result = result[1])) {
			return;
		}

		if (false && AfD_page_data) {
			CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: get_AfD_discussions of ${CeL.wiki.title_link_of(discussion_page_data)}: ${result}`);
			console.log(discussion_page_data);
		}

		// parse date from the AfD
		let timestamp = CeL.wiki.parse.date(content, {
			get_timevalue: true,
			get_all_list: true
		});
		if (timestamp && (timestamp = timestamp.max_timevalue)) {
			timestamp = (new Date(timestamp)).toISOString();
		} else {
			// ... or using revision.timestamp
			timestamp = discussion_page_data.revisions[0].timestamp;
		}
		const discussion_report = [timestamp, discussion_page_data, result];
		if (extract_target_page_of_AfD(discussion_page_data) === target_page_title) {
			previous_discussions.push(discussion_report);
		} else {
			related_discussions.push(discussion_report);
		}
	}, { no_edit: true });

	if (false && AfD_page_data) {
		CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: get_AfD_discussions last`);
		console.log(previous_discussions);
		console.log(related_discussions);
	}
	function sort_discussions(discussions, add_title) {
		return discussions
			.sort((a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)
			// discussion_report may contain links
			.map(item => `${CeL.wiki.title_link_of(item[1], to_timestamp({ timestamp: item[0] }) + (add_title ? ' ' + extract_target_page_of_AfD(item[1]) : ''))} ${/(?:^|\W)(?:delete)(?:$|\W)/i.test(item[2]) ? '{{color|red|✗}} ' : /(?:^|\W)(?:keep)(?:$|\W)/i.test(item[2]) ? '{{color|green|✓}} ' : ''}${item[2]}`);
	}
	const report = {
		previous: sort_discussions(previous_discussions),
		related: sort_discussions(related_discussions, true)
	};
	if (previous_discussions.length > 0)
		report.result = [previous_discussions[0][2], previous_discussions[0][1].title];
	if (false && AfD_page_data) {
		CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: get_AfD_discussions return`);
		console.log(report);
	}
	return report;
}

const PATTERN_PROD = /(?:^|\W)(?:PROD|soft deletion)(?:$|\W)/i;

async function get_AfD_logs(target_page_title, result_notice_data) {
	const logs = [];
	for (let log of (await wiki.logevents(target_page_title))) {
		// console.log(log);
		let log_text;
		switch (log.action) {
			case 'move':
				// type: 'move'
				log_text = `${to_timestamp(log)} move to {{color|green|→}} ${log.params && log.params.target_title && CeL.wiki.title_link_of(log.params.target_title) || 'moved'}`;
				// 光 move 還可算是 PROD。直接貼上個 redirect 才是需列入 result_notice 的問題。
				/**
				 * What would make it ineligible is if the existing article
				 * (under discussion) was redirected elsewhere, leaving its
				 * history in the same location, meaning that someone redirected
				 * it in lieu of deletion. In this case, the article (and its
				 * page history) was moved to a new location, so this case
				 * should check both whether the title redirects AND whether the
				 * page history remains. Page moves would still be eligible for
				 * soft deletion/expired PROD by my read.
				 */
				if (logs.length === 0 && result_notice_data.redirect_to === log.params.target_title) {
					delete result_notice_data.redirect;
				}
				break;
			case 'delete':
				// type: 'delete'
				let is_PROD = log.comment && PATTERN_PROD.test(log.comment)
					// params: { tags: [ 'subst:prod' ] },
					// type: 'pagetriage-curation',
					|| Array.isArray(log.params && log.params.tags) && log.params.tags.some(tag => PATTERN_PROD.test(tag));
				// [[WP:CSD]]
				let CSD_link = log.comment;
				if (CSD_link) {
					CSD_link = CSD_link.match(/\[\[[^\[\]]+\|[GARFCUTPX]\d{1,2}\]\]/)
						// e.g., "CSD-A1"
						|| CSD_link.match(/CSD[-\s]([GARFCUTPX]\d{1,2})/);
					if (CSD_link)
						CSD_link = CSD_link[0];
				}
				log_text = `${to_timestamp(log)} {{color|red|✗}} ` + (is_PROD ? '[[WP:PROD|]]' : CSD_link || 'deleted');
				const note = `${PROD_ineligible_MESSAGE_PREFIX}it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it has been [{{fullurl:Special:Log|page={{urlencode:${target_page_title}}}}} previously ${is_PROD ? "PROD'd" : 'deleted'}]${CSD_link ? ` (${CSD_link})` : ''}.`;
				if (is_PROD)
					result_notice_data.PROD = note;
				// CSD/BLPPROD doesn't affect PROD/soft deletion eligibility
				// ([[WP:PROD#cite_ref-1]]), so don't need to track that.
				if (false && is_PROD && !logs.note)
					logs.note = note;
				break;
			case 'restore':
				// type: 'delete'
				// [[File:Gnome-undelete.svg|20px]]
				log_text = `${to_timestamp(log)} {{color|blue|↻}} restored`;
				logs.note = `${PROD_ineligible_MESSAGE_PREFIX}it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it was [{{fullurl:Special:Log|page={{urlencode:${target_page_title}}}}} previously undeleted (${new Date(log.timestamp).toLocaleDateString('en-US', { dateStyle: "medium" })})].`;
				break;
			case 'create':
				// type: 'create'
				if (logs.length === 0) {
					// Skip the first 'create'
					log_text = `${to_timestamp(log)} {{color|blue|✍️}} create`;
				}
				break;
			case 'delete_redir':
				// type: 'delete'
				break;
		}
		if (log_text) {
			logs.push(log_text);
		}
	}
	return logs;
}


// ----------------------------------------------------------------------------

// parse edit summaries or diffs to find PROD
async function find_PROD_in_the_summaries(target_page_title, result_notice_data) {
	const page_data = await wiki.page(target_page_title, {
		rvprop: 'ids|timestamp|comment', rvlimit: 'max'
	});
	const revisions = page_data && page_data.revisions;
	if (!revisions) {
		console.log(page_data);
		return;
	}
	// revisions: new → old
	// TODO: link to the live diff instead if the PROD wasn't successful
	revisions.some(revision => {
		// e.g., 'prod added', NOT ' | producer = '
		if (!PATTERN_PROD.test(revision.comment))
			return;
		// NOT ineligible for PROD.
		result_notice_data.PROD = `${PROD_ineligible_MESSAGE_PREFIX}it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it has been [[Special:Diff/${revision.revid}|previously PROD'd]] (via summary).`;
		return true;
	});
}

// ----------------------------------------------------------------------------

const PROD_MESSAGE_recommendation = 'Note to closer for soft deletion';
let ignore_recommendations = {
	[PROD_MESSAGE_recommendation]: true,
	'Previous discussions': true,
	'Related discussions': true,
	'Logs': true,
};
const PROD_MESSAGE_PREFIX = `* '''${PROD_MESSAGE_recommendation}''': `;
const PROD_ineligible_MESSAGE_PREFIX = PROD_MESSAGE_PREFIX + "While this discussion appears to have [[WP:NOQUORUM|no quorum]], ";

async function for_AfD(AfD_page_data) {
	/** {String}target page title */
	const target_page_title = extract_target_page_of_AfD(AfD_page_data);
	if (!target_page_title) {
		CeL.error(`for_AfD: Can not extract target page title: ${CeL.wiki.title_link_of(AfD_page_data)}`);
		return;
	}

	let already_noticed;
	AfD_page_data.wikitext.each_between(PROD_MESSAGE_PREFIX, '\n', token => {
		const date_list = CeL.wiki.parse.date(token, { language: use_language, get_timevalue: true, get_all_list: true });
		console.log([token, date_list]);
		if (Date.now() - date_list.min_timevalue < CeL.to_millisecond('7D')) {
			already_noticed = true;
		}
	});
	if (already_noticed) {
		CeL.info(`Already noticed: ${CeL.wiki.title_link_of(AfD_page_data)}`);
		return;
	}

	// -------------------------------------------------------

	const report_lines = [];

	const participations = check_AfD_participations(AfD_page_data);

	const target_page_data = this.page_data_hash[target_page_title] || await wiki.page(target_page_title);
	// console.log(target_page_data);
	if ('missing' in target_page_data)
		return;

	const result_notice_data = Object.create(null);

	function add_report_line(logs, title) {
		if (logs.length > 0) {
			report_lines.push(`'''${title}''': <code>${logs.join('</code>, <code>')}</code>`);
		}
	}

	// -------------------------------------------------------

	const redirect_to = CeL.wiki.parse.redirect(target_page_data);
	// CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: redirect_to`);
	// console.log(redirect_to);
	if (redirect_to) {
		result_notice_data.redirect_to = redirect_to;
		result_notice_data.redirect = `${PROD_ineligible_MESSAGE_PREFIX}it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because the subject is currently redirecting to ${CeL.wiki.title_link_of(redirect_to)}.`;
		report_lines.push(`Current redirect {{color|green|↪}} ${CeL.wiki.title_link_of(redirect_to)}`);
	}

	// -------------------------------------------------------

	const discussions = await get_AfD_discussions(target_page_title, AfD_page_data);
	// CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: discussions`);
	// console.log(discussions);
	if (discussions) {
		if (discussions.result)
			result_notice_data.discussion = `${PROD_ineligible_MESSAGE_PREFIX}it is NOT eligible for [[WP:SOFTDELETE|soft deletion]] because it was [[${discussions.result[1]}|previously discussed at AfD]] and the result was ${discussions.result[0]}.`;
		add_report_line(discussions.previous, 'Previous discussions');
		add_report_line(discussions.related, 'Related discussions');
	}

	// -------------------------------------------------------

	const logs = await get_AfD_logs(target_page_title, result_notice_data);
	if (logs.note) {
		result_notice_data.log = logs.note;
	}
	// CeL.info(`${CeL.wiki.title_link_of(AfD_page_data)}: logs`);
	// console.log(logs);
	// [{{fullurl:Special:Log|page=target_page_title}} Logs]
	add_report_line(logs, 'Logs');

	// -------------------------------------------------------

	if (!result_notice_data.PROD) {
		await find_PROD_in_the_summaries(target_page_title, result_notice_data);
	}

	// -------------------------------------------------------

	let result_notice = result_notice_data.redirect || result_notice_data.discussion || result_notice_data.PROD || result_notice_data.log;
	let summary;
	if (!result_notice) {
		if (report_lines.length === 0)
			return;

		summary = 'Seems eligible for PROD';
		result_notice = `${PROD_MESSAGE_PREFIX}This nomination has had limited participation and falls within the standards set for [[WP:NOQUORUM|lack of quorum]]. There are no previous AfD discussions, undeletions, ${result_notice_data.redirect_to ? '' : 'or current redirects '}and no previous PRODs have been located. This nomination may be eligible for [[WP:SOFTDELETE|soft deletion]] at the end of its ${close_days}-day listing.`;
	}

	const participations_report = Object.keys(participations).map(type => participations[type].length > 0 && `${participations[type].length} ${type}`).filter(text => !!text).join(', ');
	if (true) {
		if (participations_report) {
			return;
		}
		report_lines.unshift(result_notice + ' --~~~~');
	} else {
		// for debug report:
		if (participations_report) {
			result_notice = 'There are participations and the report will not shown in the [[deployment environment]]: ' + participations_report
				+ '\n' + result_notice;
			return;
		} else {
			result_notice = "There is no participation and '''the report may show in the AfD'''."
				+ '\n' + result_notice;
		}

		report_lines.unshift(`=== ${CeL.wiki.title_link_of(AfD_page_data)} ===
${result_notice} --~~~~`);
	}

	const report_wikitext = report_lines.join('\n: ');
	const page_wikitext = AfD_page_data.wikitext.trimEnd() + '\n' + report_wikitext;
	//console.log(CeL.wiki.title_link_of(AfD_page_data));
	//CeL.info(page_wikitext);
	//console.log(report_lines);
	this.all_report_lines.push(report_wikitext);
	// for debug:
	// return;

	await wiki.edit_page(AfD_page_data, page_wikitext, {
		summary: `bot trial edit: [[Wikipedia:Bot requests#A heads up for AfD closers re: PROD eligibility when approaching NOQUORUM|Informing the article's PROD eligibility]]: ${summary || 'Seems NOT eligible for PROD'}`,
	});
}
