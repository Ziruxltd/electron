const https = require("https");
const cookies = require("../cookies.json");
const groups = require("../groups.json");
const { zepakClasses, WEBUNTIS_HOST } = require("./constants");

class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

function isSessionExpired(statusCode, data) {
  if (statusCode === 401 || statusCode === 403 || statusCode === 302 || statusCode === 404) {
    return true;
  }
  if (statusCode === 200) {
    try {
      const parsed = JSON.parse(data);
      return !Array.isArray(parsed.days);
    } catch (e) {
      return true;
    }
  }
  return false;
}

const COOKIE_NAME_BY_OVERRIDE_FIELD = {
  jsessionid: "JSESSIONID",
  schoolname: "schoolname",
  tenantId: "Tenant-Id",
};

function buildCookieHeader(baseCookies, overrides) {
  if (!overrides) {
    return baseCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  const remainingOverrides = new Map(
    Object.entries(overrides)
      .filter(([, value]) => value)
      .map(([field, value]) => [COOKIE_NAME_BY_OVERRIDE_FIELD[field], value])
  );

  const merged = baseCookies.map((c) => {
    if (remainingOverrides.has(c.name)) {
      const value = remainingOverrides.get(c.name);
      remainingOverrides.delete(c.name);
      return { name: c.name, value };
    }
    return c;
  });

  for (const [name, value] of remainingOverrides) {
    merged.push({ name, value });
  }

  return merged.map((c) => `${c.name}=${c.value}`).join("; ");
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function resolveSchoolYearId(schoolYears, referenceDate) {
  const match = schoolYears.find((year) => {
    const start = new Date(year.dateRange.start);
    const end = new Date(year.dateRange.end);
    return referenceDate >= start && referenceDate <= end;
  });
  return match ? match.id : null;
}

function httpGet(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on("error", (error) => {
      console.error("Request error:", error);
      reject(error);
    });

    req.end();
  });
}

function requestTimetable(options) {
  return httpGet(options);
}

function requestAuthToken(cookieHeader) {
  return httpGet({
    hostname: WEBUNTIS_HOST,
    path: "/WebUntis/api/token/new",
    method: "GET",
    headers: { Accept: "*/*", Cookie: cookieHeader },
  });
}

function requestSchoolYears(cookieHeader, bearerToken) {
  return httpGet({
    hostname: WEBUNTIS_HOST,
    path: "/WebUntis/api/rest/view/v1/schoolyears",
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${bearerToken}`,
      Cookie: cookieHeader,
    },
  });
}

const processUserInput = async (
  userValue,
  {
    session,
    fetchTimetable = requestTimetable,
    fetchAuthToken = requestAuthToken,
    fetchSchoolYears = requestSchoolYears,
  } = {}
) => {
  if (typeof userValue !== "string" || userValue.trim() === "") {
    throw new Error("Invalid input");
  }

  const processedValue = userValue.trim().toUpperCase();
  const grupoId = getGroupIdByShortName(processedValue);

  if (!grupoId) {
    throw new Error("Group not found");
  }

  const cookieHeader = buildCookieHeader(cookies, session);

  const tokenResponse = await fetchAuthToken(cookieHeader);
  if (tokenResponse.statusCode !== 200) {
    throw new SessionExpiredError();
  }
  const bearerToken = tokenResponse.data;

  const schoolYearsResponse = await fetchSchoolYears(cookieHeader, bearerToken);
  if (schoolYearsResponse.statusCode !== 200) {
    throw new SessionExpiredError();
  }
  const schoolYearId = resolveSchoolYearId(
    JSON.parse(schoolYearsResponse.data),
    new Date()
  );

  const tenantIdCookieValue =
    (session && session.tenantId) ||
    cookies.find((c) => c.name === "Tenant-Id").value;

  const today = new Date().toISOString().split('T')[0];
  const fourWeeksFromNow = new Date(Date.now() + 28 * 864e5).toISOString().split('T')[0];

  const query = {
    start: today,
    end: fourWeeksFromNow,
    format: 59,
    resourceType: "CLASS",
    resources: grupoId,
    periodTypes: "",
    timetableType: "STANDARD"
  };

  const queryString = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  const requestPath = `/WebUntis/api/rest/view/v1/timetable/entries?${queryString}`;

  const options = {
    hostname: WEBUNTIS_HOST,
    path: requestPath,
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${bearerToken}`,
      "Tenant-Id": unquote(tenantIdCookieValue),
      "X-Webuntis-Api-School-Year-Id": String(schoolYearId),
      Referer: `https://${WEBUNTIS_HOST}/timetable/class?date=${today}&entityId=${grupoId}`,
      Cookie: cookieHeader,
    },
  };

  const { statusCode, data } = await fetchTimetable(options);

  if (isSessionExpired(statusCode, data)) {
    throw new SessionExpiredError();
  }

  try {
    const json = JSON.parse(data);
    const zepak = [];
    for (const day of json.days) {
      for (const entry of day.gridEntries) {
        const subject = entry.position2?.[0]?.current.longName;
        if (zepakClasses.includes(subject)) {
          zepak.push({
            date: formattedDate(day.date),
            startTime: extractTime(entry.duration.start),
            endTime: extractTime(entry.duration.end),
            subject: subject,
            teacher: entry.position1?.[0]?.current.longName || "N/A",
            room: entry.position3?.[0]?.current.longName || "N/A",
            typeClass: entry.position4?.[0]?.current.longName || "N/A",
          });
        }
      }
    }
    console.log("CLASES DEL ZEPAK:", zepak);
    return zepak;
  } catch (e) {
    console.error("Error parsing JSON:", data);
    throw new Error("Failed to parse response");
  }
};

function formattedDate(date) {
  const [year, month, dayNum] = date.split("-");
  return `${dayNum}-${month}-${year}`;
}

function extractTime(timeStr) {
  timeStr = timeStr.split("T")[1];
  const [hours, minutes] = timeStr.split(":");
  return hours + ":" + minutes;
}

function getGroupIdByShortName(shortName) {
  for (let i = 0; i < groups.classes.length; i++) {
    if (groups.classes[i].class.shortName === shortName) {
      return groups.classes[i].class.id;
    }
  }
  return false;
}

module.exports = {
  processUserInput,
  extractTime,
  getGroupIdByShortName,
  isSessionExpired,
  buildCookieHeader,
  resolveSchoolYearId,
  unquote,
  SessionExpiredError
};
