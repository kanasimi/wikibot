'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

replace_tool.replace({
	API_URL: 'test', ignore_language: true,
	not_bot_requests: true,
}, {
	'task 1': 'task 1 done',
	'Template:L1': 'subst:',
	'task 2': 'task 2 done',
});
