const fs = require('fs');
let content = fs.readFileSync('src/utils/generateConfigs.ts', 'utf8');

// Supprime le bloc const B
content = content.replace(/\/\/ ─── Références bash[^\n]*\n\/\/ Usage[^\n]*\nconst B = \{[\s\S]*?\}\n\n/, '');

const fixes = [
  ['${B.CYAN}',   '\${CYAN}'],
  ['${B.NC}',     '\${NC}'],
  ['${B.GREEN}',  '\${GREEN}'],
  ['${B.RED}',    '\${RED}'],
  ['${B.YELLOW}', '\${YELLOW}'],
  ['${B.BOLD}',   '\${BOLD}'],
  ['${B.IFACE}',  '\${IFACE}'],
  ['${B.PKG}',    '\${PKG}'],
  ['${B.SVC}',    '\${svc}'],
  ['${B.WGDIR}',  '\${WG_DIR}'],
];

for (const [from, to] of fixes) {
  const count = content.split(from).length - 1;
  if (count > 0) console.log(`  ${from} → ${to} (${count}x)`);
  content = content.split(from).join(to);
}

fs.writeFileSync('src/utils/generateConfigs.ts', content);
const remaining = (content.match(/\$\{B\./g) || []).length;
console.log('Occurrences B. restantes:', remaining);
