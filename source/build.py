# Assemble index.html à partir de src/
import os
d=os.path.dirname(os.path.abspath(__file__))   # dossier source/
root=os.path.dirname(d)
r=lambda p: open(os.path.join(d,p),encoding='utf-8').read()
HEAD_WEB='''
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#6E4B2E">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" href="/icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Lucarne">'''
def page(BACKEND):
  return f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Lucarne — le jeu foot de la semaine</title>{HEAD_WEB if BACKEND=="backend_web.js" else ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Gochi+Hand&family=Inter:wght@400;500;600;700;800&family=Anton&display=swap" rel="stylesheet">
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
