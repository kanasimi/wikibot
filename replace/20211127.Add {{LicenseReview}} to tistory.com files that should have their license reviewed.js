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
	}, {
		'-incategory:License_review_needed insource:".tistory.com" -insource:/\\{\\{Extracted from/ -insource:/\\{\\{LicenseReview\\|/': { text_processor }
	});
})();

async function text_processor(wikitext, page_data, work_config) {
	const parsed = page_data.parse();
	CeL.assert([wikitext, parsed.toString()], 'wikitext parser check: ' + CeL.wiki.title_link_of(page_data));

	// e.g., [[File:Yoon Bomi at Severance Hospital, May 2013.jpg]]
	if (/{{Licensereview/.test(wikitext)
		// e.g., [[File:Adilson dos Santos.jpg]]
		|| /{{ *PermissionTicket *[|}]/.test(wikitext))
		return;

	const matched = wikitext.match(/https?:\/\/\w+\.tistory\.com\//);
	// {{LicenseReview|site=}} will cause [abusefilter-warning] ⧼abusefilter-warning-review⧽
	const template_token = `{{LicenseReview|site=${matched ? matched[0] : 'tistory.com'}}}` && `{{LicenseReview}}`;
	//console.log(template_token);

	parsed.insert_layout_token(template_token, 'footer');
	//console.log(parsed.toString())
	return parsed.toString();
}
