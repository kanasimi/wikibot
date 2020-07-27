'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'https://t-echo.co.jp/?page_id=': 'https://houei.t-echo.co.jp/?page_id=',
});
