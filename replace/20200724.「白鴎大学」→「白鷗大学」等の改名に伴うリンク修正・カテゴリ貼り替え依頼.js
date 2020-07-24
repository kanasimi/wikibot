'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

function fix_鴎(wikitext, page_data) {
	return wikitext.replace(/白鴎大/g, '白鷗大');
}

function fix_link_鴎(token) {
	if (token[2] && String(token[2]).includes('鴎')) {
		token[2] = String(token[2]).replace(/鴎/g, '鷗');
		// 去掉與頁面標題相同的 display_text。
		if (!token[1] && token[2] === token[0])
			token.pop();
	}
}

async function setup_move_configuration(meta_configuration, options) {
	for (const move_to_link of Object.values(meta_configuration.task_configuration_from_section)) {
		move_to_link.after_for_each_link = fix_link_鴎;
	}
	return;

	// リンクのない表記についてもご対応いただきたい
	//console.log(meta_configuration);
	const move_configuration = Object.create(null);
	for (const move_to_link of Object.values(meta_configuration.task_configuration_from_section)) {
		move_configuration[move_to_link.move_to_link] = { text_processor: fix_鴎 };
	}
	delete meta_configuration.task_configuration_from_section;
	return move_configuration;
}

const replace_白鴎大学_task_configuration = {
	'insource:"白鴎大学"': '白鷗大学',
	'insource:"白鴎大"': '白鷗大'
};

replace_tool.replace({
	// Do not get move configuration from section.
	no_task_configuration_from_section: true,

	//「鴎友学園女子中学校・高等学校」→「鷗友学園女子中学校・高等学校」の改名に伴うリンク修正依頼 diff=78618417
	//diff_id: 78618417,
}, setup_move_configuration
//&& replace_白鴎大学_task_configuration
);
