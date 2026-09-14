const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadSession, saveSession } = require("../src/sessionStore");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "session-store-test-"));
}

const VALID_SESSION = {
  jsessionid: "ABC123",
  schoolname: '"_ZWh1"',
  tenantId: '"6184100"',
};

test("loadSession devuelve todos los campos a null si no hay ninguna sesion guardada todavia", () => {
  const dir = makeTempDir();
  assert.deepEqual(loadSession(dir), {
    jsessionid: null,
    schoolname: null,
    tenantId: null,
  });
});

test("saveSession guarda los 3 campos y loadSession los recupera", () => {
  const dir = makeTempDir();
  saveSession(dir, VALID_SESSION);
  assert.deepEqual(loadSession(dir), VALID_SESSION);
});

test("saveSession sobreescribe la sesion anterior con la mas reciente", () => {
  const dir = makeTempDir();
  saveSession(dir, VALID_SESSION);
  saveSession(dir, {
    jsessionid: "NEW-ID",
    schoolname: '"nueva"',
    tenantId: '"999"',
  });
  assert.deepEqual(loadSession(dir), {
    jsessionid: "NEW-ID",
    schoolname: '"nueva"',
    tenantId: '"999"',
  });
});

test("saveSession recorta espacios en blanco antes de guardar", () => {
  const dir = makeTempDir();
  saveSession(dir, {
    jsessionid: "  ABC123  ",
    schoolname: '  "_ZWh1"  ',
    tenantId: '  "6184100"  ',
  });
  assert.deepEqual(loadSession(dir), VALID_SESSION);
});

test("saveSession lanza un error si falta el jsessionid", () => {
  const dir = makeTempDir();
  assert.throws(
    () => saveSession(dir, { ...VALID_SESSION, jsessionid: "" }),
    /Invalid session: jsessionid/
  );
});

test("saveSession lanza un error si falta el schoolname", () => {
  const dir = makeTempDir();
  assert.throws(
    () => saveSession(dir, { ...VALID_SESSION, schoolname: "   " }),
    /Invalid session: schoolname/
  );
});

test("saveSession lanza un error si falta el tenantId", () => {
  const dir = makeTempDir();
  assert.throws(
    () => saveSession(dir, { ...VALID_SESSION, tenantId: null }),
    /Invalid session: tenantId/
  );
});

test("saveSession crea el directorio de almacenamiento si no existe", () => {
  const dir = path.join(makeTempDir(), "nested", "dir");
  saveSession(dir, VALID_SESSION);
  assert.deepEqual(loadSession(dir), VALID_SESSION);
});

test("loadSession devuelve todos los campos a null si el fichero de sesion esta corrupto", () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, "session.json"), "{ esto no es json valido");
  assert.deepEqual(loadSession(dir), {
    jsessionid: null,
    schoolname: null,
    tenantId: null,
  });
});
