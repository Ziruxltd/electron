const https = require("https");
const cookies = require("../cookies.json");
const groups = require("../groups.json");
const { zepakClasses } = require("./constants");

const processUserInput = (userValue) => {
  return new Promise((resolve, reject) => {
    if (typeof userValue !== "string" || userValue.trim() === "") {
      reject(new Error("Invalid input"));
      return;
    }

    const processedValue = userValue.trim().toUpperCase();
    const grupoId = getGroupIdByShortName(processedValue);

    if (!grupoId) {
      reject(new Error("Group not found"));
      return;
    }

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
      hostname: "hektor.webuntis.com",
      path: requestPath,
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Anonymous-School": "EHU",
        "X-Webuntis-Api-School-Year-Id": "34",
        Referer: `https://hektor.webuntis.com/timetable/class?date=2025-09-22&entityId=${grupoId}`,
        Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
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
          resolve(zepak);
        } catch (e) {
          console.error("Error parsing JSON:", data);
          reject(new Error("Failed to parse response"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("Request error:", error);
      reject(error);
    });

    req.end();
  });
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
  getGroupIdByShortName
};
