/*

	初版試營運。
	完成。正式運用。

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

// ----------------------------------------------------------------------------

(async () => {
	await replace_tool.replace({
		language: 'commons',
		log_to: null,
	}, {
		'incategory:"Images uploaded by Fæ" insource:legislation.gov.uk filemime:pdf insource:"Enacted version"': { namespace: 'file', text_processor }
	});
})();

async function text_processor(wikitext, page_data, work_config) {
	const parsed = page_data.parse();
	CeL.assert([wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));

	let changed;
	parsed.each('Template:book', template_token => {
		//console.log(template_token.parameters.other_versions.toString());
		if (/\| *Enacted version/.test(template_token.parameters.other_versions)) {
			changed = true;
			template_token[template_token.index_of.other_versions]
				= template_token[template_token.index_of.other_versions].toString()
					.replace(/\| *Enacted version/g, '|{{en|Version from legislation.gov.uk, which may incoporate revisions or ammendments.}}{{zh|來自legislation.gov.uk的版本，其中可能包含修訂或修正。}}');
			return template_token.toString();
		}
	}, true);

	if (changed)
		return parsed.toString();
}
