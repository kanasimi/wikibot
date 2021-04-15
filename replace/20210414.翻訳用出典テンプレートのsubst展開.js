'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

const task_configuration = Object.create(null);
[
	'Cite web/German',
	'Cite web/French',
	'Cite web/Swedish',
	'Cita libro',
	'Книга',
	'Статья',
	'Literatur'
].forEach(
	template_name => task_configuration['Template:' + template_name] = {
		namespace: 0, for_template, for_each_template_options: {
			add_index: 'all'
		}, page_limit: 1
	}
);

replace_tool.replace(null, task_configuration);

// ----------------------------------------------------------------------------

// subst展開 [[mw:Help:Substitution]]
async function for_template(token, index, parent) {
	//this.discard_changes = true;
	token[0] = 'subst:' + token[0];
	const page_title = this.page_to_edit.title;
	//this.task_configuration.wiki.append_session_to_options().session;

	if (CeL.wiki.parser.token_is_children_of(parent,
		parent => parent.type === 'tag' && (parent.tag === 'ref' || parent.tag === 'gallery')
	)) {
		//console.trace([page_title, token.toString(), parent]);
		// [[mw:Help:Cite#Substitution and embedded parser functions]] [[w:en:Help:Substitution#Limitation]]
		// refタグ内ではsubst:をつけても展開されず、そのまま残ります。人間による編集の場合は一旦refタグを外して、差分から展開したソースをコピーする形になります。

		// TODO: this.task_configuration.wiki.expandtemplates(), this.task_configuration.wiki.compare()
		// useless:
		//const expand_data = await new Promise(resolve => CeL.wiki.query(token.toString(), resolve, this.task_configuration.wiki.append_session_to_options()));

		let wikitext = await this.task_configuration.wiki.query({
			action: "compare",
			fromtitle: page_title,
			fromslots: "main",
			'fromtext-main': "",
			toslots: "main",
			'totext-main': token.toString(),
			topst: 1,
		});
		//console.log(wikitext);
		wikitext = wikitext.compare['*']
			// TODO: shoulld use HTML parser
			.between('<td class="diff-addedline">', '</td>').replace(/^<div>/, '').replace(/<\/div>$/, '');
		wikitext = CeL.HTML_to_Unicode(wikitext);
		//console.trace([page_title, token.toString(), wikitext]);
		parent[index] = wikitext;
	}
}
