const fs = require('fs');
let content = fs.readFileSync('src/utils/generateConfigs.ts', 'utf8');

// Supprime le bloc const B = { ... }
content = content.replace(/\/\/ ─── Références bash \(évite.*?\n\}\n\n/s, '');

// Remplace ${B.XXX} par \${XXX}
const fixes = [
  ['${B.CYAN}',   String.raw`\${CYAN}`],
  ['${B.NC}',     String.raw`\${NC}`],
  ['${B.GREEN}',  String.raw`\${GREEN}`],
  ['${B.RED}',    String.raw`\${RED}`],
  ['${B.YELLOW}', String.raw`\${YELLOW}`],
  ['${B.BOLD}',   String.raw`\${BOLD}`],
  ['${B.IFACE}',  String.raw`\${IFACE}`],
  ['${B.PKG}',    String.raw`\${PKG}`],
  ['${B.SVC}',    String.raw`\${svc}`],
  ['${B.WGDIR}',  String.raw`\${WG_DIR}`],
];

for (const [from, to] of fixes) {
  content = content.split(from).join(to);
}

fs.writeFileSync('src/utils/generateConfigs.ts', content);
const remaining = (content.match(/\$\{B\./g) || []).length;
console.log('Done. Occurrences B. restantes:', remaining);
