const sendButton = document.getElementById('sendButton')
const resultDisplay = document.getElementById('result')

const sessionModalOverlay = document.getElementById('sessionModalOverlay')
const sessionForm = document.getElementById('sessionForm')
const jsessionidInput = document.getElementById('jsessionidInput')
const schoolnameInput = document.getElementById('schoolnameInput')
const tenantIdInput = document.getElementById('tenantIdInput')
const sessionModalError = document.getElementById('sessionModalError')

sendButton.addEventListener('click', () => runQuery())

sessionForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const newSession = {
    jsessionid: jsessionidInput.value.trim(),
    schoolname: schoolnameInput.value.trim(),
    tenantId: tenantIdInput.value.trim()
  }

  if (!newSession.jsessionid || !newSession.schoolname || !newSession.tenantId) {
    sessionModalError.textContent = 'Rellena los 3 campos'
    return
  }

  try {
    await window.versions.saveSession(newSession)
    hideSessionModal()
    await runQuery()
  } catch (error) {
    sessionModalError.textContent = `Error al guardar la sesión: ${error.message}`
  }
})

async function runQuery () {
  try {
    const result = await window.versions.fetchSchedule()
    renderScheduleTable(result)
  } catch (error) {
    if (error.message.includes('SESSION_EXPIRED')) {
      showSessionModal()
      return
    }
    showMessage(`Error: ${error.message}`, 'error')
  }
}

function showMessage (text, type) {
  resultDisplay.innerHTML = `<div class="result-message ${type}">${text}</div>`
}

function showSessionModal () {
  sessionModalError.textContent = ''
  jsessionidInput.value = ''
  schoolnameInput.value = ''
  tenantIdInput.value = ''
  sessionModalOverlay.hidden = false
  jsessionidInput.focus()
}

function hideSessionModal () {
  sessionModalOverlay.hidden = true
}

function renderScheduleTable (result) {
  if (!result || result.length === 0) {
    showMessage('No se han encontrado clases en este periodo', 'success')
    return
  }

  const subjects = [...new Set(result.map(r => r.subject))]
  const dates = [...new Set(result.map(r => r.date))]

  let tableHtml = '<table class="schedule-table">'
  tableHtml += '<thead><tr><th>Día</th>'
  subjects.forEach(subject => {
    tableHtml += `<th>${subject}</th>`
  })
  tableHtml += '</tr></thead><tbody>'

  dates.forEach(date => {
    tableHtml += `<tr><td>${date}<br/>${getDay(date)}</td>`
    subjects.forEach(subject => {
      const entries = result.filter(r => r.date === date && r.subject === subject)
      if (entries.length > 0) {
        tableHtml += '<td>'
        entries.forEach(entry => {
          tableHtml += `
            <div class="entry-card">
              <b>${entry.typeClass}</b><br>
              ${entry.startTime} - ${entry.endTime}<br>
              ${entry.group}<br>
              ${entry.room}
            </div>`
        })
        tableHtml += '</td>'
      } else {
        tableHtml += '<td></td>'
      }
    })
    tableHtml += '</tr>'
  })

  tableHtml += '</tbody></table>'
  resultDisplay.innerHTML = tableHtml
}

function getDay (date) {
  const days = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
  ]
  const [year, month, dayNum] = date.split('-')
  const dayIndex = new Date(year, month - 1, dayNum).getDay()
  return days[dayIndex]
}
