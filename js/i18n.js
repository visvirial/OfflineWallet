/** @file i18n.js
 * 
 */

const I18N_AVAILABLE_LANGS = ['en', 'ja'];

var i18n_translations = [];

// Load locale files.
I18N_AVAILABLE_LANGS.forEach(function(lang){
	document.write('<script src="locale/'+lang+'.js"></script>');
});

var setLang = function(lang){
	localStorage.setItem('lang', lang);
	window.location.reload();
}
var getLang = function(){
	var lang = localStorage.getItem('lang');
	if(!lang){
		var acceptLanguage = (navigator.browserLanguage || navigator.language || navigator.userLanguage);
		lang = acceptLanguage.substr(0, 2);
	}
	return lang == null ? 'en' : lang;
}

var _ = function(text){
	try{
		var translation = i18n_translations[getLang()][text][1];
		if(translation) return translation;
	}catch(e){
	}
	return text;
}

$(function(){
	$('.locale').css('display', 'none');
	$('.locale-'+getLang()).css('display', 'inline');
	$('.locale-tooltip[data-toggle=tooltip]').each(function(){
		$(this).attr('title', $(this).attr('data-title-'+getLang()));
	});
	$('.current-lang').html(getLang());
});

