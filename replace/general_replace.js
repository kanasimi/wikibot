'use strict';

globalThis.no_task_date_warning = true;

// Load replace tools.
const replace_tool = require('./replace_tool.js');

let section_title = CeL.env.arg_hash && CeL.env.arg_hash.section_title || CeL.env.argv[2];
section_title = typeof section_title === 'string' && section_title.trim();

const KEY_show_sections = 'show_sections';
const KEY_replace_all = 'replace_all';

if (!section_title) {
	// 「」→「」の改名に伴うリンク修正依頼
	CeL.info(`
Usage:
node ${script_name} "section title"
node ${script_name} "section title" diff=0000
node ${script_name} "section_title=section title" diff=0000 use_language=ja also_replace_text
node ${script_name} "section title" diff=0000 allow_empty skip_nochange=false
node ${script_name} "section title" "also_replace_text=title1|title2"
node ${script_name} "section title" "task_configuration={""from|from"":""to|to""}" no_task_configuration_from_section
node ${script_name} "section title" "task_configuration={""http://url/"":""https://url/""}"

Show all titles:
node general_replace.js ${KEY_show_sections} use_language=${use_language && 'ja'}

Auto-replace all titles:
node general_replace.js ${KEY_replace_all} use_language=${use_language && 'ja'}
`.trim());
	process.exit();
}

check_section = '20190913';
log_to = 'User:' + user_name + '/log/' + check_section;

if (section_title === KEY_show_sections || section_title === KEY_replace_all) {
	const need_replace_all = section_title === KEY_replace_all;
	(async () => {
		const meta_configuration = Object.create(null);
		const all_section_data = await replace_tool.get_all_sections(meta_configuration), need_close = [];
		for (const section_title in all_section_data) {
			const section_data = all_section_data[section_title];
			if (section_data.task_configuration) {
				CeL.info(`node ${script_name} ${section_title.includes(' ') ? JSON.stringify(section_title) : section_title} use_language=${use_language}`);
				if (need_replace_all) {
					await replace_tool.replace({
						section_title,
					});
					need_close.modified = true;
				}
				continue;
			}
			if (section_data.finished) {
				continue;
			}
			if (section_data.doing && section_data.completed) {
				CeL.debug(section_title);
				need_close.push(section_title);
			} else {
				CeL.log(section_title);
			}
			//console.log(section_data);
		}
		if (!need_replace_all || need_close.modified || need_close.length === 0) {
			return;
		}

		//console.trace(need_close);
		Object.assign(meta_configuration, {
			for_section(section) {
				const section_title = section.section_title.link[1];
				if (need_close.includes(section_title)) {
					const parsed = this;
					parsed[section.range[0]] = parsed[section.range[0]].toString().replace(/^(\n*)/, '$1{{解決済み|~~~~}}\n');
				}
			},
			section_title: need_close.length === 1 && need_close[0],
			for_section_options: {
				need_edit: true,
				summary: need_close.length === 1 ? 'Close request' : `Close ${need_close.length} requests`
			}
		});
		await replace_tool.get_all_sections(meta_configuration);
	})();

} else {
	replace_tool.replace();
}
