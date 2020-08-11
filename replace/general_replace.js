'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

let section_title = CeL.env.arg_hash && CeL.env.arg_hash.section_title || CeL.env.argv[2];
section_title = typeof section_title === 'string' && section_title.trim();

const KEY_show_sections = 'show_sections';

if (!section_title) {
	// 「」→「」の改名に伴うリンク修正依頼
	CeL.info(`
Usage:
node ${script_name} "section title"
node ${script_name} "section title" diff=0000
node ${script_name} "section_title=section title" diff=0000 use_language=ja also_replace_text
node ${script_name} "section title" diff=0000 allow_empty skip_nochange=false

Show all titles:
node general_replace.js ${KEY_show_sections} use_language=${use_language}
`);
	process.exit();
}

if (section_title === KEY_show_sections) {
	(async () => {
		const all_section_data = await replace_tool.get_all_sections();
		for (const section_title in all_section_data) {
			const section_data = all_section_data[section_title];
			if (section_data.task_configuration)
				CeL.info(`node ${script_name} ${section_title.includes(' ') ? JSON.stringify(section_title) : section_title} use_language=${use_language}`);
		}
	})();

} else {
	check_section = '20190913';
	log_to = 'User:' + user_name + '/log/' + check_section;

	replace_tool.replace();
}
