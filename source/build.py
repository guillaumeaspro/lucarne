# Assemble index.html à partir de src/
import os
d=os.path.dirname(os.path.abspath(__file__))   # dossier source/
root=os.path.dirname(d)
r=lambda p: open(os.path.join(d,p),encoding='utf-8').read()
def page(BACKEND):
  return f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lucarne — le quiz foot de la semaine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">
<style>{r('style.css')}</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
{r('questions.js')}
{r('data.js')}
{r('app.js')}
{r(BACKEND)}
</script>
</body>
</html>
'''


open(os.path.join(root,'index.html'),'w',encoding='utf-8').write(page('backend_web.js'))
open(os.path.join(d,'artifact.html'),'w',encoding='utf-8').write(page('backend_claude.js'))
print('ok : index.html (site) + source/artifact.html (version claude.ai)')
