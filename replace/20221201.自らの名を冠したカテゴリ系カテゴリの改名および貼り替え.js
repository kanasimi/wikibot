'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('ja');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

const page_list = ['Category‐ノート:自らの名を冠したカテゴリ/移行先一覧Part1', 'Category‐ノート:自らの名を冠したカテゴリ/移行先一覧Part2'];

(async () => {
	let task_configuration = {};
	for (const page_title of page_list) {
		const move_pairs = await replace_tool.parse_move_pairs_from_page(page_title, { using_table: true, ignore_multiple_link_warnings: true, wiki });
		//console.log(move_pairs);
		for (const [move_from_link, move_to_link] of Object.entries(move_pairs)) {
			task_configuration[move_from_link] = {
				do_move_page: {
					noredirect: 1,
					// ノートページのリダイレクトは過去ログ参照用に残していただきたかったです
					movetalk: false,
				},
				move_to_link,
				postfix
			};
		}
	}
	//console.log(task_configuration);
	//return;

	await wiki.register_redirects(['Template:Hiddencat', 'Template:Wikipedia category', 'Template:告知']);

	await replace_tool.replace({
		//not_bot_requests: true,
	}, task_configuration);

})();

async function postfix() {
	const task_configuration = this;
	//console.trace(task_configuration);
	const wiki = task_configuration.wiki;
	await wiki.edit_page(task_configuration.move_to_link, for_each_category_page, {
		summary: task_configuration.summary
	});

	// ノートページのリダイレクトは過去ログ参照用に残していただきたかったです
	const from_talk = wiki.to_talk_page(task_configuration.move_from_link);
	const to_talk = wiki.to_talk_page(task_configuration.move_to_link);
	if ((await wiki.page(to_talk)).wikitext && ('missing' in await wiki.page(from_talk))) {
		//console.trace(to_talk);
		await wiki.move_page(to_talk, from_talk, task_configuration.do_move_page);
		await wiki.move_page(from_talk, to_talk, { ...task_configuration.do_move_page, noredirect: false, });
	}
}

const remove_token = CeL.wiki.parser.parser_prototype.each.remove_token;

function for_each_category_page(page_data) {
	const parsed = page_data.parse();

	// さらに、{{Hiddencat}}または{{Wikipedia category|hidden=yes}}の類が貼られているカテゴリは隠しカテゴリを解除します。
	parsed.each('Template:Hiddencat', template_token => remove_token);
	parsed.each('Template:Wikipedia category', template_token => {
		if (template_token.parameters.hidden) {
			CeL.wiki.parse.replace_parameter(template_token, 'hidden', CeL.wiki.parse.replace_parameter.KEY_remove_parameter);
		}
	});

	// 先日のBot作業で貼り付けていただいた告知テンプレートも剥がしていただけると助かります。
	parsed.each('Template:告知', template_token => remove_token);

	const wikitext = parsed.toString()
		// e.g., [[Category:愛知県の企業別のトピックス]]
		// fix {{Template:Category:日本の都道府県/下位|愛知県||企業名を冠したカテゴリ|...}}
		.replace(/企業名を冠したカテゴリ/g, '企業別のトピックス');
	return wikitext === page_data.wikitext ? Wikiapi.skip_edit : wikitext;
}
