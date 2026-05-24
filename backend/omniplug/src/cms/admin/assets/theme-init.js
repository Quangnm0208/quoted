(function() {
  var theme = 'light';
  try {
    theme = localStorage.getItem('omniplug_theme') || 'light';
  } catch (_) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
