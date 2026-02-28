import { ensureCA, getCAPath, getTrustInstructions } from "../src/main/proxy/tls";

const ca = ensureCA();

console.log(`Rashomon CA certificate: ${getCAPath()}`);
console.log(`Private key: ${ca.keyPath}`);
for (const instruction of getTrustInstructions()) {
  console.log(`- ${instruction}`);
}
