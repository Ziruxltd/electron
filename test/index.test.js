const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isSessionExpired,
  buildCookieHeader,
  resolveSchoolYearId,
  unquote,
  SessionExpiredError,
  processUserInput,
  extractTime,
  getGroupIdByShortName,
} = require("../src/index");

const groups = require("../groups.json");
// processUserInput uppercases the user's input before matching, so pick a
// fixture whose shortName is already all-uppercase (some entries, like room
// reservations, aren't) to avoid a false "Group not found" in these tests.
const validShortName = groups.classes.find(
  (c) => c.class.shortName === c.class.shortName.toUpperCase()
).class.shortName;

const okAuthToken = async () => ({ statusCode: 200, data: "FAKE-BEARER-TOKEN" });
const okSchoolYears = async () => ({
  statusCode: 200,
  data: JSON.stringify([
    { id: 36, dateRange: { start: "2026-09-07", end: "2027-07-31" } },
    { id: 34, dateRange: { start: "2025-09-08", end: "2026-09-06" } },
  ]),
});

test("isSessionExpired es true cuando el status code es 401", () => {
  assert.equal(isSessionExpired(401, "cualquier cosa"), true);
});

test("isSessionExpired es true cuando el status code es 403", () => {
  assert.equal(isSessionExpired(403, "cualquier cosa"), true);
});

test("isSessionExpired es true cuando el status code es 302 (redirect a login)", () => {
  assert.equal(isSessionExpired(302, ""), true);
});

test("isSessionExpired es true cuando el status code es 404 (WebUntis devuelve NOT_FOUND si la sesion no es valida)", () => {
  assert.equal(isSessionExpired(404, JSON.stringify({ errorCode: "NOT_FOUND" })), true);
});

test("isSessionExpired es true cuando el status es 200 pero el cuerpo no es JSON valido (pagina de login)", () => {
  assert.equal(isSessionExpired(200, "<html>login</html>"), true);
});

test("isSessionExpired es false cuando el status es 200 y el cuerpo es JSON valido", () => {
  assert.equal(isSessionExpired(200, JSON.stringify({ days: [] })), false);
});

test("isSessionExpired es true cuando el status es 200 pero el JSON es un error sin 'days' (WebUntis devuelve NOT_FOUND con sesion caducada)", () => {
  const errorBody = JSON.stringify({
    errorCode: "NOT_FOUND",
    requestId: "abc",
    errorMessage: "Not Found",
  });
  assert.equal(isSessionExpired(200, errorBody), true);
});

test("buildCookieHeader une las cookies base cuando no hay override", () => {
  const cookies = [
    { name: "JSESSIONID", value: "ORIGINAL" },
    { name: "schoolname", value: "ehu" },
    { name: "Tenant-Id", value: "111" },
  ];
  assert.equal(
    buildCookieHeader(cookies),
    "JSESSIONID=ORIGINAL; schoolname=ehu; Tenant-Id=111"
  );
});

test("buildCookieHeader reemplaza JSESSIONID, schoolname y Tenant-Id por el override cuando se indican", () => {
  const cookies = [
    { name: "JSESSIONID", value: "ORIGINAL" },
    { name: "schoolname", value: "ehu-viejo" },
    { name: "Tenant-Id", value: "111" },
    { name: "traceId", value: "sin-cambios" },
  ];
  assert.equal(
    buildCookieHeader(cookies, {
      jsessionid: "NUEVO-ID",
      schoolname: '"ehu-nuevo"',
      tenantId: '"999"',
    }),
    'JSESSIONID=NUEVO-ID; schoolname="ehu-nuevo"; Tenant-Id="999"; traceId=sin-cambios'
  );
});

test("buildCookieHeader añade las cookies de override si no existen en las cookies base", () => {
  const cookies = [{ name: "traceId", value: "abc" }];
  assert.equal(
    buildCookieHeader(cookies, {
      jsessionid: "NUEVO-ID",
      schoolname: '"ehu"',
      tenantId: '"999"',
    }),
    'traceId=abc; JSESSIONID=NUEVO-ID; schoolname="ehu"; Tenant-Id="999"'
  );
});

test("buildCookieHeader solo reemplaza los campos de override presentes, deja el resto igual", () => {
  const cookies = [
    { name: "JSESSIONID", value: "ORIGINAL" },
    { name: "schoolname", value: "ehu-viejo" },
    { name: "Tenant-Id", value: "111" },
  ];
  assert.equal(
    buildCookieHeader(cookies, { jsessionid: "NUEVO-ID" }),
    "JSESSIONID=NUEVO-ID; schoolname=ehu-viejo; Tenant-Id=111"
  );
});

test("processUserInput rechaza con SessionExpiredError cuando la sesion ha caducado", async () => {
  const fakeFetcher = async () => ({ statusCode: 401, data: "" });

  await assert.rejects(
    () =>
      processUserInput(validShortName, {
        fetchTimetable: fakeFetcher,
        fetchAuthToken: okAuthToken,
        fetchSchoolYears: okSchoolYears,
      }),
    SessionExpiredError
  );
});

test("processUserInput rechaza con SessionExpiredError si no se puede obtener un token de autenticacion", async () => {
  const failingAuthToken = async () => ({ statusCode: 401, data: "" });

  await assert.rejects(
    () =>
      processUserInput(validShortName, {
        fetchAuthToken: failingAuthToken,
        fetchSchoolYears: okSchoolYears,
      }),
    SessionExpiredError
  );
});

test("processUserInput rechaza con SessionExpiredError si no se puede obtener la lista de cursos escolares", async () => {
  const failingSchoolYears = async () => ({ statusCode: 401, data: "" });

  await assert.rejects(
    () =>
      processUserInput(validShortName, {
        fetchAuthToken: okAuthToken,
        fetchSchoolYears: failingSchoolYears,
      }),
    SessionExpiredError
  );
});

test("processUserInput usa la sesion recibida (jsessionid, schoolname, tenantId) para construir la peticion", async () => {
  let receivedOptions;
  const fakeFetcher = async (options) => {
    receivedOptions = options;
    return { statusCode: 200, data: JSON.stringify({ days: [] }) };
  };

  await processUserInput(validShortName, {
    session: {
      jsessionid: "SESION-CUSTOM",
      schoolname: '"ehu-custom"',
      tenantId: '"999"',
    },
    fetchTimetable: fakeFetcher,
    fetchAuthToken: okAuthToken,
    fetchSchoolYears: okSchoolYears,
  });

  assert.match(receivedOptions.headers.Cookie, /JSESSIONID=SESION-CUSTOM/);
  assert.match(receivedOptions.headers.Cookie, /schoolname="ehu-custom"/);
  assert.match(receivedOptions.headers.Cookie, /Tenant-Id="999"/);
  assert.equal(receivedOptions.headers.Authorization, "Bearer FAKE-BEARER-TOKEN");
  assert.equal(receivedOptions.headers["Tenant-Id"], "999");
  assert.equal(receivedOptions.headers["X-Webuntis-Api-School-Year-Id"], "36");
  assert.equal(receivedOptions.hostname, "ehu.webuntis.com");
});

test("processUserInput devuelve el listado de clases cuando la sesion es valida", async () => {
  const fakeFetcher = async () => ({
    statusCode: 200,
    data: JSON.stringify({ days: [] }),
  });

  const result = await processUserInput(validShortName, {
    fetchTimetable: fakeFetcher,
    fetchAuthToken: okAuthToken,
    fetchSchoolYears: okSchoolYears,
  });

  assert.deepEqual(result, []);
});

test("processUserInput rechaza con error normal si el input esta vacio (comportamiento existente)", async () => {
  await assert.rejects(() => processUserInput(""), /Invalid input/);
});

test("processUserInput rechaza con error normal si el grupo no existe (comportamiento existente)", async () => {
  await assert.rejects(
    () => processUserInput("GRUPO-QUE-NO-EXISTE-XYZ"),
    /Group not found/
  );
});

test("resolveSchoolYearId devuelve el id del curso escolar que contiene la fecha dada", () => {
  const schoolYears = [
    { id: 36, dateRange: { start: "2026-09-07", end: "2027-07-31" } },
    { id: 34, dateRange: { start: "2025-09-08", end: "2026-09-06" } },
  ];
  assert.equal(resolveSchoolYearId(schoolYears, new Date("2026-09-14")), 36);
});

test("resolveSchoolYearId devuelve null si ningun curso escolar contiene la fecha", () => {
  const schoolYears = [
    { id: 34, dateRange: { start: "2025-09-08", end: "2026-09-06" } },
  ];
  assert.equal(resolveSchoolYearId(schoolYears, new Date("2026-09-14")), null);
});

test("unquote elimina las comillas envolventes de un valor de cookie", () => {
  assert.equal(unquote('"_ZWh1"'), "_ZWh1");
});

test("unquote deja igual un valor que no tiene comillas", () => {
  assert.equal(unquote("6184100"), "6184100");
});

test("extractTime sigue extrayendo la hora de un timestamp ISO (comportamiento existente)", () => {
  assert.equal(extractTime("2025-09-22T08:30:00"), "08:30");
});

test("getGroupIdByShortName sigue encontrando el id por shortName (comportamiento existente)", () => {
  const expected = groups.classes.find(
    (c) => c.class.shortName === validShortName
  ).class.id;
  assert.equal(getGroupIdByShortName(validShortName), expected);
});
