'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

const PATTERN_date_minus = /(\|\s*[a-z]*date *)-( *[12][0-9]{3})/g;

function text_processor(wikitext) {
	return PATTERN_date_minus.test(wikitext) ? wikitext.replace(/*this.move_from_link*/PATTERN_date_minus, '$1=$2') : Wikiapi.skip_edit;
}

replace_tool.replace({
	requests_page_rvlimit: 800,
	// Do not use move configuration from section.
	no_task_configuration_from_section: true,
}, {
	'[a-z]*date-year': {
		list_types: 'search',
		//move_from_link: PATTERN_date_minus,
		//move_from_link: /date *- *\d{4}/,
		//move_from_link: "date-",
		//move_from_link: /date *- *\d/,
		//move_from_link: /\|\s*date *-/,
		move_from_link: /\|accessdate-/,
		text_processor
	},
});
