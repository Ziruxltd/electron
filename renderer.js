const sendButton = document.getElementById('sendButton')
const userInput = document.getElementById('userInput')
const resultDisplay = document.getElementById('result')

sendButton.addEventListener('click', async () => {
  const inputValue = userInput.value.trim()
  
  if (inputValue === '') {
    resultDisplay.textContent = 'Por favor, ingresa un valor'
    resultDisplay.style.color = 'red'
    return
  }
  
  try {
    const result = await window.versions.processUserInput(inputValue)
    // Prepare table data
    const subjects = [...new Set(result.map(r => r.subject))];
    const dates = [...new Set(result.map(r => r.date))];

    // Build table header
    let tableHtml = '<table border="1" style="border-collapse:collapse;width:100%">';
    tableHtml += '<thead><tr><th>Día</th>';
    subjects.forEach(subject => {
      tableHtml += `<th>${subject}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Build table rows
    dates.forEach(date => {
      tableHtml += `<tr><td> ${date} <br/> ${getDay(date)} </td>`;
      subjects.forEach(subject => {
      const entries = result.filter(r => r.date === date && r.subject === subject);
      if (entries.length > 0) {
        tableHtml += '<td>';
        entries.forEach(entry => {
            if (entry !== entries[0]) {
            tableHtml += '<hr/>';
            }
            tableHtml += `
            <div style="border:1px solid #ccc; margin-bottom:4px; padding:4px;">
              <b>${entry.typeClass}</b><br>
              ${entry.startTime} - ${entry.endTime}<br>
              ${entry.teacher}<br>
              ${entry.room}
            </div>`;
        });
        tableHtml += '</td>';
      } else {
        tableHtml += '<td></td>';
      }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    resultDisplay.innerHTML = tableHtml;
    resultDisplay.style.color = 'green'
    
    userInput.value = ''
  } catch (error) {
    resultDisplay.textContent = `Error: ${error.message}`
    resultDisplay.style.color = 'red'
  }
})

function getDay(date) {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado"
  ];
  const [year, month, dayNum] = date.split("-");
  const dayIndex = new Date(year, month - 1, dayNum).getDay();
  return days[dayIndex];
}