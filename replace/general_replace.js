'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

if ((!CeL.env.arg_hash || !CeL.env.arg_hash.section_title) && !CeL.env.argv[2]) {
	// 「」→「」の改名に伴うリンク修正依頼
	CeL.info(`
Usage:
node ${script_name} "section title"
node ${script_name} "section title" "diff_id=0000"
node ${script_name} "section_title=section title" "diff_id=0000" "use_language=ja" "also_replace_text"

Show all titles:
node general_replace.js ${replace_tool.KEY_show_sections} use_language=${use_language}
`);
	process.exit();
}

check_section = '20190913';
log_to = 'User:' + user_name + '/log/' + check_section;

replace_tool.replace();
