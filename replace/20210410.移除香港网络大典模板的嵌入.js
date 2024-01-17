'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'Template:Evchk': {
		move_to_link: DELETE_PAGE,
		namespace: 0,
		//allow_blanking: true
	}
});
