import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const htmlFiles = readdirSync('.').filter(f => f.endsWith('.html'));

const inlineScript = `<script>
      (function(){
        try {
          var t = localStorage.getItem("alverde-tema");
          var valid = t === "midnight-bio" ? "midnight-bio" : "alverde-botanical";
          document.documentElement.setAttribute("data-theme", valid);
          var c = {"alverde-botanical":"#f1f3ed","midnight-bio":"#111511"};
          var m = document.querySelector('meta[name="theme-color"]');
          if (m) m.setAttribute("content", c[valid]);
        } catch(e) {}
      })();
    </script>
  </head>`;

for (const file of htmlFiles) {
  let content = readFileSync(file, 'utf8');
  content = content.replace(/<meta name="theme-color"[^>]*>/, '<meta name="theme-color" content="#f1f3ed" />');
  
  if (content.includes('localStorage.getItem("alverde-tema")')) {
    console.log(`Skipping ${file}, already has inline script`);
    continue;
  }
  
  content = content.replace('</head>', inlineScript);
  writeFileSync(file, content);
  console.log(`Injected script into ${file}`);
}
