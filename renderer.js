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
    resultDisplay.textContent = `Resultado: ${JSON.stringify(result)}`
    resultDisplay.style.color = 'green'
    
    userInput.value = ''
  } catch (error) {
    resultDisplay.textContent = `Error: ${error.message}`
    resultDisplay.style.color = 'red'
  }
})