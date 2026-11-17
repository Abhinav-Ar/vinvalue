export type Theme = 'light' | 'night';
export const THEME_KEY = 'autoiq-theme';

/** Runs before paint (inlined in <head>): stored choice, else the OS preference. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='night'){t=matchMedia('(prefers-color-scheme: dark)').matches?'night':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

