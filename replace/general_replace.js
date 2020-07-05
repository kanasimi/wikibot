'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

if ((!CeL.env.arg_hash || !CeL.env.arg_hash.section_title) && !CeL.env.argv[2]) {
	CeL.info(`
Usage:
node general_replace.js "section title"
node general_replace.js "section_title=section title"
`);
	process.exit();
}

check_section = '20190913';
log_to = 'User:' + user_name + '/log/' + check_section;

replace_tool.replace();
