/**
 * highlight.js 配置文件
 * 静态注册AI高频语言，实现精准tree-shaking，控制bundle体积
 */
import hljs from 'highlight.js/lib/core';

// 按需导入AI高频语言
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import markdown from 'highlight.js/lib/languages/markdown';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml'; // HTML使用xml语言包

/**
 * 注册支持的编程语言
 * 总增量 <25KB（未gzip），满足轻量化要求
 */
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript); // 别名
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript); // 别名
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python); // 别名
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown); // 别名
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);

/**
 * 导出配置好的highlight.js实例
 */
export default hljs;

/**
 * 获取支持的语言列表
 */
export const getSupportedLanguages = (): string[] => {
  return hljs.listLanguages();
};

/**
 * 检查语言是否支持
 */
export const isLanguageSupported = (language: string): boolean => {
  return hljs.getLanguage(language) !== undefined;
};