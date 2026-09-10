// Surface initialization errors instead of leaving an apparently working editor.
import('./app.mjs').catch(error => {
  document.getElementById('raw').disabled = true;
  document.getElementById('commit').disabled = true;
  document.getElementById('input-help').textContent = 'Could not load the input engine. Please reload the demo.';
  document.getElementById('preedit').textContent = 'The input engine is unavailable.';
  console.error('Polytype initialization failed', error);
});
