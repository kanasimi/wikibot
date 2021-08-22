'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

const PATTERN_to_replace = /(class="(?:|[^"|]*? ))(collapsible|collapsed)/g;

function text_processor(wikitext) {
	let changed;
	wikitext = wikitext.replace_till_stable(PATTERN_to_replace, (all, prefix, class_name) => {
		changed = true;
		return prefix + 'mw-' + class_name;
	});
	return changed ? wikitext : Wikiapi.skip_edit;
}

replace_tool.replace({
}, {
	'insource:/class=\\"collaps/': { text_processor },
	'insource:/class=\\"[^"]* collaps/': { text_processor },
	'insource:/[" ]collaps/': { text_processor },
	'insource:/\\<includeonly\\> *collaps/': {
		text_processor(wikitext) {
			return wikitext.replace(/<includeonly> *(collapsible|collapsed)/g, all => all.replace(/(collaps)/, 'mw-$1'));
		}
	},
	'insource:/\\{\\{\\{state *\\| *collaps/': {
		text_processor(wikitext) {
			return wikitext.replace(/{{{ *state *\| *(collapsible|collapsed)/g, all => all.replace(/(collaps)/, 'mw-$1'));
		}
	},
});
