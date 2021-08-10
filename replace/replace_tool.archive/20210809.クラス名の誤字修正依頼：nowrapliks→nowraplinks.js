'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

const PATTERN_to_replace = /(class="(?:|[^"|]*? ))(nowrapliks)/g;

function text_processor(wikitext) {
	let changed;
	wikitext = wikitext.replace_till_stable(PATTERN_to_replace, (all, prefix, class_name) => {
		changed = true;
		return prefix + 'nowraplinks';
	});
	return changed ? wikitext : Wikiapi.skip_edit;
}

replace_tool.replace({
}, {
	'insource:/[" ]nowrapliks/': {
		text_processor
	},
});
