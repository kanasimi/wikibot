'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');

replace_tool.replace(null, {
	'Template:Cite web/German': { namespace: '0', for_template },
	'Template:Cite web/French': { namespace: '0', for_template },
	'Template:Cite web/Swedish': { namespace: '0', for_template },
	'Template:Cita libro': { namespace: '0', for_template },
	'Template:Книга': { namespace: '0', for_template },
	'Template:Статья': { namespace: '0', for_template },
	'Template:Literatur': { namespace: '0', for_template },
});

// subst展開 [[mw:Help:Substitution]]
async function for_template(token, index, parent) {
	//console.log(parent.parent);
	//console.log(parent.parent?.tag);
	if (parent.parent?.tag === 'ref') {
		// [[mw:Help:Cite#Substitution and embedded parser functions]] [[w:en:Help:Substitution#Limitation]]
		// refタグ内ではsubst:をつけても展開されず、そのまま残ります。人間による編集の場合は一旦refタグを外して、差分から展開したソースをコピーする形になります。
		// TODO: this.task_configuration.wiki.expandtemplates()
		const expand_data = await new Promise(resolve => CeL.wiki.expandtemplates(token.toString(), resolve, this.task_configuration.wiki.append_session_to_options()));
		//console.log([token.toString(), expand_data]);
		parent[index] = expand_data.wikitext;
	} else {
		token[0] = 'subst:' + token[0];
	}
}
