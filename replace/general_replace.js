/*

node general_replace.js 車站編號標誌 get_task_configuration_from=list namespace=Module also_replace_text_insource
node general_replace.js 車站編號標誌 get_task_configuration_from=list skip_nochange=false
//node general_replace.js 批次修改命名錯誤的用戶框 get_task_configuration_from=list "namespace=*" min_list_length=1
node general_replace.js 批次修改命名錯誤的用戶框 get_task_configuration_from=list namespace=user min_list_length=1
node general_replace.js 請求批次轉換內部連結 get_task_configuration_from=list

node general_replace.js 郑州南站改为郑州航空港站 get_task_configuration_from=list min_list_length=1
node general_replace.js "請求替換用戶頁中的模板：{{Youtube User}} → {{User YouTube}}" get_task_configuration_from=list min_list_length=1 namespace=user
node general_replace.js "移除小天體模板所有鏈入" "task_configuration={""Template:小天體"":""DELETE_PAGE""}" no_task_configuration_from_section
node general_replace.js "将条目中使用 模板 Imdb与IMDB的替换为 IMDb name" get_task_configuration_from=list min_list_length=1
node general_replace.js "清理{{悠遊卡}}、{{一卡通}}嵌入" "task_configuration={""Template:悠遊卡"":""DELETE_PAGE"",""Template:一卡通"":""DELETE_PAGE"",""Template:Icash"":""DELETE_PAGE""}" no_task_configuration_from_section
node general_replace.js "羽毛球賽事級別索引模板" get_task_configuration_from=list min_list_length=1

*/

'use strict';

globalThis.no_task_date_warning = true;

// Load replace tools.
const replace_tool = require('./replace_tool.js');

let section_title = CeL.env.arg_hash && CeL.env.arg_hash.section_title || CeL.env.argv[2];
section_title = typeof section_title === 'string' && section_title.trim();

const KEY_show_sections = 'show_sections';
const KEY_replace_all = 'replace_all';

if (!section_title) {
	// 「」→「」の改名に伴うリンク修正依頼
	CeL.info(`
Usage:
node ${script_name} "request section title"
node ${script_name} "request section title" diff=0000
node ${script_name} "section_title=request section title" diff=0000 use_language=ja also_replace_text_insource
node ${script_name} "request section title" keep_display_text allow_empty skip_nochange=false
node ${script_name} "request section title" "also_replace_text_insource=title1|title2"
node ${script_name} "request section title" "task_configuration={""from|from"":""to|to""}" no_task_configuration_from_section
node ${script_name} "request section title" "task_configuration={""link_title"":""link_title""}" no_task_configuration_from_section "replace_text_pattern=/從頁面內文文字/改成文字/g"
node ${script_name} "request section title" "task_configuration={""from"":""DELETE_PAGE""}" no_task_configuration_from_section
node ${script_name} "request section title" "task_configuration={""http://url/"":""https://url/""}"
node ${script_name} "request section title" "task_configuration={""insource:\\\\""[[T|T]]\\\\"""":""T""}"
node ${script_name} "request section title" "task_configuration={""insource:\\\\""從文字\\\\"""":""改成文字""}"
node ${script_name} "request section title" get_task_configuration_from=list|table

Show all titles:
node general_replace.js ${KEY_show_sections} use_language=${use_language && 'ja'}

Auto-replace all titles:
node general_replace.js ${KEY_replace_all} use_language=${use_language && 'ja'}
`.trim());
	process.exit();
}

check_section = '20190913';
log_to = 'User:' + CeL.wiki.extract_login_user_name(login_options.user_name) + '/log/' + check_section;

if (section_title === KEY_show_sections || section_title === KEY_replace_all) {
	const need_replace_all = section_title === KEY_replace_all;
	(async () => {
		const meta_configuration = Object.create(null);
		const all_section_data = await replace_tool.get_all_sections(meta_configuration), need_close = [];
		//console.trace(all_section_data);
		for (const section_title in all_section_data) {
			const section_data = all_section_data[section_title];
			if (section_data.task_configuration) {
				CeL.info(`node ${script_name} ${section_title.includes(' ') ? JSON.stringify(section_title) : section_title} use_language=${use_language}`);
				if (need_replace_all) {
					await replace_tool.replace({
						section_title,
					});
					need_close.modified = true;
				}
				continue;
			}
			if (section_data.finished || section_data.withdrawed) {
				continue;
			}
			if (section_data.completed && (section_data.doing || section_data.done)) {
				CeL.debug(section_title);
				need_close.push(section_title);
			} else {
				CeL.log(section_title);
			}
			//console.trace(section_data);
		}
		if (!need_replace_all || need_close.modified || need_close.length === 0) {
			//console.trace(need_close);
			return;
		}

		//console.trace(need_close);
		Object.assign(meta_configuration, {
			for_section(section) {
				const section_title = section.section_title.title;
				//console.trace([section_title, need_close]);
				if (need_close.includes(section_title)) {
					const parsed = this;
					parsed[section.range[0]] = parsed[section.range[0]].toString().replace(/^(\n*)/, '$1{{解決済み|~~~~}}\n');
				}
			},
			section_title: need_close.length === 1 && need_close[0],
			for_section_options: {
				need_edit: true,
				// gettext_config:{"id":"close-$1-requests-$2"}
				summary: CeL.gettext('Close %1 {{PLURAL:%1|request|requests}}: %2', need_close.length, need_close.join(', '))
			}
		});
		//console.trace(meta_configuration);
		await replace_tool.get_all_sections(meta_configuration);
	})();

} else {
	replace_tool.replace();
}
