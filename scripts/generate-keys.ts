import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { encodeBase64 } = naclUtil;

const key = nacl.randomBytes(nacl.secretbox.keyLength);

console.log(`VAULT_MASTER_KEY=${encodeBase64(key)}`);
