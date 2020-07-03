'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace({
}, {
	'ムン山駅#|': '文山駅|汶山駅',
	ムン山駅: REDIRECT_TARGET,
});
